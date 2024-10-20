use crate::client::GlobalState;
use std::sync::{
    atomic::{AtomicU32, Ordering},
    Arc,
};

use futures_util::{stream::SplitStream, SinkExt, StreamExt};
use rand::Rng;
use tokio::sync::{mpsc::UnboundedSender, RwLock};
use warp::{filters::ws::WebSocket, ws::Message};

use crate::client::{ClientData, ClientList};

/// Represents a message sendable by the client
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, ts_rs::TS)]
#[serde(tag = "type")]
#[ts(export, export_to = "../../frontend/src/server_bindings.ts")]
pub enum ClientMessage {
    Play { note: String, volume: f32 },
    Stop { note: String, sustain: bool },
    InstrumentChange { instrument_name: String },
}

/// Represents a message sendable by the server
#[derive(Debug, Clone, serde::Serialize, ts_rs::TS)]
#[serde(tag = "type")]
#[ts(export, export_to = "../../frontend/src/server_bindings.ts")]
pub enum ServerMessage<'a> {
    Error {
        error: String,
    },
    ClientConnect(&'a ClientData),
    ReceiveInfo {
        client_list: &'a Vec<ClientData>,
        created_client: &'a ClientData,
    },
    ClientDisconnect {
        id: u32,
    },
    Relay {
        msg: ClientMessage,
        id: u32,
    },
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct QueryParams {
    room_name: String,
    instrument_name: String,
}

impl QueryParams {
    async fn check(&self, state: &Arc<RwLock<GlobalState>>) -> anyhow::Result<ClientList> {
        if self.room_name.len() > 100 {
            anyhow::bail!("Room name to long!");
        }

        let mut state = state.write().await;
        let room_entry = state.rooms.entry(self.room_name.clone());
        let client_list = room_entry.or_insert_with(ClientList::default).clone();
        if client_list.get().await.len() > 25 {
            anyhow::bail!("Room already has over 25 people");
        }
        Ok(client_list)
    }
}

pub struct WebsocketConnection {
    ws_receiver: SplitStream<WebSocket>,
    ws_sender: UnboundedSender<Vec<u8>>,
    params: QueryParams,
    state: Arc<RwLock<GlobalState>>,
    id: u32,
}

// Unique ID counter
static NEXT_ID: AtomicU32 = AtomicU32::new(0);

impl WebsocketConnection {
    pub fn new(ws: WebSocket, params: QueryParams, state: Arc<RwLock<GlobalState>>) -> Self {
        let (mut ws_tx, ws_rx) = ws.split();
        let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();

        // Channel and task to listen and relay websocket messages
        // ws_tx can't be cloned so we need to make a mpsc channel to have multiple senders
        tokio::task::spawn(async move {
            while let Some(message) = rx.recv().await {
                if ws_tx.send(Message::binary(message)).await.is_err() {
                    break;
                }
            }
        });

        Self {
            params,
            ws_sender: tx,
            ws_receiver: ws_rx,
            state,
            id: NEXT_ID.fetch_add(1, Ordering::Relaxed),
        }
    }

    pub async fn handle_connection(&mut self) {
        if let Err(err) = self.on_connect().await {
            let _ = self.send_message(ServerMessage::Error {
                error: err.to_string(),
            });
            log::error!(
                "Websocket client disconnected with error (id={}): {err:?}",
                self.id
            );
        } else {
            log::info!("Websocket client disconnected (id={})", self.id);
        }

        let _ = self.on_disconnect().await;
    }

    async fn on_connect(&mut self) -> anyhow::Result<()> {
        log::info!("Websocket client connected (id={})", self.id);
        let client_list = self.params.check(&self.state).await?;

        let client_data = ClientData {
            id: self.id,
            color_hue: rand::thread_rng().gen_range(0..360),
            instrument_name: self.params.instrument_name.clone(),
            ws_sender: self.ws_sender.clone(),
        };

        // Send the list of clients in this room to only the connecting client so it knows the people here
        // And the client data as well
        self.send_message(ServerMessage::ReceiveInfo {
            client_list: &*client_list.get().await,
            created_client: &client_data,
        })?;

        client_list
            .send_to_all(ServerMessage::ClientConnect(&client_data), self.id)
            .await?;
        client_list.get_mut().await.push(client_data);

        // Listen for websocket messages from client
        while let Some(ws_result) = self.ws_receiver.next().await {
            let message = ws_result?;
            self.handle_websocket_message(message.as_bytes(), &client_list)
                .await?;
        }

        Ok(())
    }

    async fn on_disconnect(&mut self) -> anyhow::Result<()> {
        let client_list = match self.state.read().await.rooms.get(&self.params.room_name) {
            Some(list) => list.clone(),
            None => return Ok(()),
        };

        // Find the client and remove it when disconnect
        client_list.remove(self.id).await?;

        // If there are no clients left, delete the room
        if client_list.get().await.len() == 0 {
            let mut state = self.state.write().await;
            state.rooms.remove(&self.params.room_name);
        } else {
            let message = ServerMessage::ClientDisconnect { id: self.id };
            client_list.send_to_all(message, self.id).await.ok();
        }

        Ok(())
    }

    async fn handle_websocket_message(
        &mut self,
        data: &[u8],
        client_list: &ClientList,
    ) -> anyhow::Result<()> {
        if data.is_empty() {
            return Ok(());
        }

        let msg = rmp_serde::from_slice::<ClientMessage>(data)?;

        if let ClientMessage::InstrumentChange {
            ref instrument_name,
            ..
        } = msg
        {
            let index = client_list.get_index(self.id).await?;
            let mut client_list = client_list.get_mut().await;
            client_list[index].instrument_name = instrument_name.clone();
        }

        let message = ServerMessage::Relay { msg, id: self.id };
        client_list.send_to_all(message, self.id).await?;

        Ok(())
    }

    fn send_message(&self, message: ServerMessage<'_>) -> anyhow::Result<()> {
        self.ws_sender.send(rmp_serde::to_vec_named(&message)?)?;
        Ok(())
    }
}

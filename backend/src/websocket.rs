use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicU32, Ordering},
        Arc,
    },
};

use futures_util::{stream::SplitStream, SinkExt, StreamExt};
use rand::Rng;
use tokio::sync::{mpsc::UnboundedSender, RwLock};
use warp::{filters::ws::WebSocket, ws::Message};

use crate::client::{ClientData, ClientList};

#[derive(Default)]
pub struct GlobalState {
    rooms: HashMap<String, ClientList>,
}

/// Represents a message sendable by the client and server
/// Note: any message with skip_deserializing can't be sendable by the client
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, ts_rs::TS)]
#[serde(tag = "type")]
#[ts(export, export_to = "../../frontend/src/server_bindings.ts")]
pub enum WebsocketMessage<'a> {
    #[serde(skip_deserializing)]
    Error { error: String },
    #[serde(skip_deserializing)]
    ClientConnect(&'a ClientData),
    #[serde(skip_deserializing)]
    ReceiveInfo {
        client_list: &'a Vec<ClientData>,
        created_client: &'a ClientData,
    },
    #[serde(skip_deserializing)]
    ClientDisconnect { id: u32 },
    PlayNote {
        note: String,
        volume: f32,
        id: Option<u32>,
    },
    StopNote {
        note: String,
        sustain: bool,
        id: Option<u32>,
    },
    InstrumentChange {
        instrument_name: String,
        id: Option<u32>,
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
    client_list: Option<ClientList>,
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
            client_list: None,
            params,
            ws_sender: tx,
            ws_receiver: ws_rx,
            state,
            id: NEXT_ID.fetch_add(1, Ordering::Relaxed),
        }
    }

    pub async fn handle_connection(&mut self) {
        if let Err(err) = self.on_connect().await {
            let _ = self.send_message(&WebsocketMessage::Error {
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
        let client_list = self.params.check(&self.state).await?;

        let client_data = ClientData {
            id: self.id,
            color_hue: rand::thread_rng().gen_range(0..360),
            instrument_name: self.params.instrument_name.clone(),
            ws_sender: self.ws_sender.clone(),
        };

        // Send the list of clients in this room to only the connecting client so it knows the people here
        // And the client data as well
        self.send_message(&WebsocketMessage::ReceiveInfo {
            client_list: &*client_list.get().await,
            created_client: &client_data,
        })?;

        client_list
            .send_to_all(&WebsocketMessage::ClientConnect(&client_data), self.id)
            .await?;
        client_list.get_mut().await.push(client_data);
        self.client_list = Some(client_list);

        // Listen for websocket messages from client
        while let Some(ws_result) = self.ws_receiver.next().await {
            let message = ws_result?;
            if let Err(error) = self.handle_websocket_message(message.as_bytes()).await {
                log::error!("Failed to handle websocket message: {error}");
            }
        }

        Ok(())
    }

    async fn on_disconnect(&mut self) -> anyhow::Result<()> {
        let client_list = self.client_list.as_ref().unwrap();
        // Find the client and remove it when disconnect
        client_list.remove(self.id).await?;

        // If there are no clients left delete the room
        if client_list.get().await.len() == 0 {
            let mut state = self.state.write().await;
            state.rooms.remove(&self.params.room_name);
        } else {
            let message = WebsocketMessage::ClientDisconnect { id: self.id };
            client_list.send_to_all(&message, self.id).await.ok();
        }

        Ok(())
    }

    async fn handle_websocket_message(&mut self, data: &[u8]) -> anyhow::Result<()> {
        if data.is_empty() {
            return Ok(());
        }

        let client_list = self.client_list.as_ref().unwrap();

        let mut message = rmp_serde::from_slice(data)?;
        match message {
            WebsocketMessage::PlayNote { ref mut id, .. }
            | WebsocketMessage::StopNote { ref mut id, .. }
            | WebsocketMessage::InstrumentChange { ref mut id, .. } => {
                // Send the event to all the clients but with the id set by us
                *id = Some(self.id);
                client_list.send_to_all(&message, self.id).await?;
            }
            _ => (),
        };

        if let WebsocketMessage::InstrumentChange {
            instrument_name, ..
        } = message
        {
            let mut client_list = client_list.get_mut().await;
            let client = client_list.iter_mut().find(|client| client.id == self.id);
            client.unwrap().instrument_name = instrument_name;
        }

        Ok(())
    }

    fn send_message(&self, message: &WebsocketMessage<'_>) -> anyhow::Result<()> {
        self.ws_sender.send(rmp_serde::to_vec_named(message)?)?;
        Ok(())
    }
}

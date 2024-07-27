use std::{
    borrow::Borrow,
    collections::HashMap,
    net::{Ipv4Addr, SocketAddr},
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
};

use futures_util::{stream::SplitSink, SinkExt, StreamExt};
use rand::Rng;
use tokio::sync::RwLock;
use warp::{filters::ws::WebSocket, Filter};

// Unique ID counter
static NEXT_USER_ID: AtomicU64 = AtomicU64::new(1);

#[derive(Clone, serde::Serialize)]
struct ClientData {
    color_hue: u16,
    socket_id: u64,
    instrument_name: String,
    #[serde(skip)]
    channel: tokio::sync::mpsc::UnboundedSender<String>,
}

#[derive(Default, Clone)]
struct ClientList(Arc<RwLock<Vec<ClientData>>>);

impl ClientList {
    async fn send_to_all(
        &self,
        message: &WebsocketMessage<'_>,
        local_id: u64,
    ) -> anyhow::Result<()> {
        for client in self.0.read().await.iter() {
            if local_id == client.socket_id {
                continue;
            }

            client.channel.send(serde_json::to_string(&message)?)?;
        }

        Ok(())
    }
}

#[derive(Default)]
struct State {
    rooms: HashMap<String, ClientList>,
}

#[derive(Clone, serde::Serialize, serde::Deserialize)]
#[serde(tag = "type")]
enum WebsocketMessage<'a> {
    Error {
        error: String,
    },
    #[serde(skip_deserializing)]
    ClientConnect(&'a ClientData),
    #[serde(skip_deserializing)]
    ReceiveInfo {
        client_list: &'a Vec<ClientData>,
        created_client: &'a ClientData,
    },
    ClientDisconnect {
        socket_id: u64,
    },
    PlayNote {
        note: String,
        volume: f32,
        socket_id: Option<u64>,
    },
    StopNote {
        note: String,
        sustain: bool,
        socket_id: Option<u64>,
    },
    InstrumentChange {
        instrument_name: String,
        socket_id: Option<u64>,
    },
}

#[derive(serde::Serialize, serde::Deserialize)]
struct QueryParams {
    room_name: String,
    instrument_name: String,
}

#[tokio::main]
async fn main() {
    env_logger::builder()
        .format_timestamp(None)
        .filter_level(log::LevelFilter::Warn)
        .filter_module("backend", log::LevelFilter::Trace)
        .parse_env("RUST_LOG")
        .init();

    if let Err(err) = dotenvy::dotenv() {
        log::warn!("Dotenv failed to initialize: {err}");
    }

    let state = Arc::new(RwLock::new(State::default()));

    // Setup cors
    let mut cors = warp::cors().allow_methods(vec!["GET", "POST"]);
    if let Ok(origin) = std::env::var("CORS_ORIGIN") {
        cors = cors.allow_origin(origin.as_str());
    } else {
        cors = cors.allow_any_origin();
    }

    let websocket = warp::ws()
        .and(warp::query::<QueryParams>())
        .and(warp::any().map(move || state.clone()))
        .map(
            |ws: warp::ws::Ws, params: QueryParams, state: Arc<RwLock<State>>| {
                ws.on_upgrade(|ws| async move {
                    let socket_id = NEXT_USER_ID.fetch_add(1, Ordering::Relaxed);
                    if let Err(err) = on_connect(ws, &params, &state, socket_id).await {
                        log::error!("Websocket error (disconnected): {err:?}")
                    } else {
                        log::info!("Websocket client disconnected");
                    }

                    on_disconnect(&state, socket_id, &params).await;
                })
            },
        )
        .with(cors);

    let port = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(5000);
    let address = SocketAddr::from((Ipv4Addr::UNSPECIFIED, port));
    log::info!("Started websocket server on {address}");
    warp::serve(websocket).run(address).await;
}

async fn on_connect(
    ws: WebSocket,
    params: &QueryParams,
    state: &Arc<RwLock<State>>,
    socket_id: u64,
) -> anyhow::Result<()> {
    let (mut ws_tx, mut ws_rx) = ws.split();

    log::info!("Websocket client connected");

    if params.room_name.len() > 100 {
        anyhow::bail!("Room name to long!");
    }

    let clients = match check_params(params, state).await {
        Ok(clients) => clients,
        Err(err) => {
            send_websocket_message(
                &mut ws_tx,
                &WebsocketMessage::Error {
                    error: err.to_string(),
                },
            )
            .await?;
            return Err(err);
        }
    };

    // Create the client
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();
    let client_data = ClientData {
        socket_id,
        color_hue: rand::thread_rng().gen_range(0..360),
        instrument_name: params.instrument_name.clone(),
        channel: tx,
    };

    // Send the list of clients in this room to only the connecting client so it knows the people here
    // And the client data as well
    send_websocket_message(
        &mut ws_tx,
        &WebsocketMessage::ReceiveInfo {
            client_list: clients.0.read().await.borrow(),
            created_client: &client_data,
        },
    )
    .await?;

    clients
        .send_to_all(&WebsocketMessage::ClientConnect(&client_data), socket_id)
        .await?;
    clients.0.write().await.push(client_data);

    // Channel and task to listen and relay websocket messages
    tokio::task::spawn(async move {
        while let Some(message) = rx.recv().await {
            if ws_tx.send(warp::ws::Message::text(message)).await.is_err() {
                break;
            }
        }
    });

    while let Some(ws_result) = ws_rx.next().await {
        if let Ok(string) = ws_result?.to_str() {
            log::info!("Got from websocket: {string}");
            if let Err(error) = handle_websocket_message(string, &clients, socket_id).await {
                log::error!("{error}");
            }
        }
    }

    Ok(())
}

async fn on_disconnect(state: &Arc<RwLock<State>>, socket_id: u64, params: &QueryParams) {
    // Find the client and remove it when disconnect
    if let Some(clients) = state.read().await.rooms.get(&params.room_name) {
        let mut clients_locked = clients.0.write().await;
        let index = clients_locked.iter().position(|client| {
            //
            client.socket_id == socket_id
        });

        if let Some(index) = index {
            clients_locked.swap_remove(index);

            // If there are no clients left delete the room
            if clients_locked.len() == 0 {
                state.write().await.rooms.remove(&params.room_name);
            } else {
                drop(clients_locked);
                let message = WebsocketMessage::ClientDisconnect { socket_id };
                clients.send_to_all(&message, socket_id).await.ok();
            }
        }
    }
}

async fn check_params(
    params: &QueryParams,
    state: &Arc<RwLock<State>>,
) -> anyhow::Result<ClientList> {
    if params.room_name.len() > 100 {
        anyhow::bail!("Room name to long!");
    }

    let clients = state
        .write()
        .await
        .rooms
        .entry(params.room_name.clone())
        .or_insert_with(ClientList::default)
        .clone();
    if clients.0.read().await.len() > 50 {
        anyhow::bail!("Room already has over 50 people");
    }

    Ok(clients)
}

async fn handle_websocket_message(text: &str, clients: &ClientList, id: u64) -> anyhow::Result<()> {
    let mut message = serde_json::from_str(text)?;
    match message {
        #[rustfmt::skip]
        WebsocketMessage::PlayNote { ref mut socket_id, .. }
        | WebsocketMessage::StopNote { ref mut socket_id, .. }
        | WebsocketMessage::InstrumentChange { ref mut socket_id, .. } => {
            *socket_id = Some(id);
            clients.send_to_all(&message, id).await?;
        }
        _ => (),
    };

    Ok(())
}

async fn send_websocket_message(
    ws_tx: &mut SplitSink<WebSocket, warp::ws::Message>,
    message: &WebsocketMessage<'_>,
) -> anyhow::Result<()> {
    Ok(ws_tx
        .send(warp::ws::Message::text(serde_json::to_string(message)?))
        .await?)
}

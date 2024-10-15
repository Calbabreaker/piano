use std::{
    net::{Ipv4Addr, SocketAddr},
    sync::Arc,
};
use tokio::sync::RwLock;
use warp::Filter;

use crate::websocket::{GlobalState, QueryParams, WebsocketConnection};

mod client;
mod websocket;

#[tokio::main]
async fn main() {
    env_logger::builder()
        .format_timestamp(None)
        .filter_level(log::LevelFilter::Warn)
        .filter_module("piano_backend", log::LevelFilter::Trace)
        .parse_env("RUST_LOG")
        .init();

    if let Err(err) = dotenvy::dotenv() {
        log::warn!("Dotenv failed to initialize: {err}");
    }

    let state = Arc::new(RwLock::new(GlobalState::default()));

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
            |ws: warp::ws::Ws, params: QueryParams, state: Arc<RwLock<GlobalState>>| {
                ws.on_upgrade(|ws| async move {
                    WebsocketConnection::new(ws, params, state)
                        .handle_connection()
                        .await;
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

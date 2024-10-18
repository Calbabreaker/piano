use std::{
    net::{Ipv4Addr, SocketAddr},
    sync::Arc,
};
use tokio::sync::RwLock;
use warp::Filter;

use crate::{
    client::GlobalState,
    websocket::{QueryParams, WebsocketConnection},
};

mod client;
mod websocket;

pub async fn start_server() {
    let state = Arc::new(RwLock::new(GlobalState::default()));

    // Setup cors
    let mut cors = warp::cors().allow_methods(vec!["GET", "POST"]);
    if let Ok(origin) = std::env::var("CORS_ORIGIN") {
        cors = cors.allow_origin(origin.as_str());
        log::info!("Using cors origin: {origin}");
    } else {
        cors = cors.allow_any_origin();
        log::info!("Using cors origin: *");
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

    let port = get_port_from_env().unwrap_or(5000);
    let address = SocketAddr::from((Ipv4Addr::UNSPECIFIED, port));
    log::info!("Started websocket server on {address}");
    warp::serve(websocket).run(address).await;
}

fn get_port_from_env() -> anyhow::Result<u16> {
    Ok(std::env::var("PORT")?.parse()?)
}

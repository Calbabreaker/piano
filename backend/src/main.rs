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

    piano_backend::start_server().await;
}

use piano_backend::schema;
use prost::Message;

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

    let mut buf = Vec::new();
    let mut message = schema::ServerMessage {
        r#type: Some(schema::server_message::Type::Relay(
            schema::RelayClientMessage {
                message: Some(schema::ClientMessage {
                    r#type: Some(schema::client_message::Type::PlayNote(schema::PlayNote {
                        note: "59".to_string(),
                        volume: 10.1,
                    })),
                }),
                id: 69,
            },
        )),
    };

    message.encode(&mut buf);

    dbg!(buf.len());

    dbg!(schema::ServerMessage::decode(buf.as_ref()));

    piano_backend::start_server().await
}

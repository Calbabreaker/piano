# Piano Backend

This folder contains the code for the backend Rust websocket server (uses warp tokio).

Add a .env file with these contents to set the cors allow origin (default any origin):

```
CORS_ORIGIN=https://example.com
```

## Developing

Run `cargo run -r` to build and run.

Run `cargo test` to generate typescript types.

## Docker

Run `docker-compose -f docker-compose-prod.yaml up` to use the prebuilt docker image.

Or build it manually: `docker-compose up --build`.

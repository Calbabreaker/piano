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

Run `docker run -d --name piano-backend -p 5000:5000 --restart unless-stopped ghcr.io/calbabreaker/piano-backend` to use the prebuilt docker image.

Or build it manually: `docker build . -t piano-backend`.

Then run: `docker run -d --name piano-backend -p 5000:5000 --restart unless-stopped piano-backend`

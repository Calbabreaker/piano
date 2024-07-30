# Piano Backend

This folder contains the code for the backend Rust websocket server (uses warp tokio).

Add a .env file with these contents to set the cors allow origin (default any origin):

```
CORS_ORIGIN=https://example.com
```

## Developing

Run `cargo run -r` to build and run.

FROM rust:1.85 AS builder

WORKDIR /server

# Create an empty project to cache dependencies
RUN cargo init --bin
COPY Cargo.toml Cargo.lock ./
RUN cargo build --release
RUN rm -rf ./src
RUN rm ./target/release/piano-backend

# Copy and build the source files
COPY ./src ./src
RUN cargo build --release

# Use a slim image for running
FROM debian:bookworm-slim

COPY --from=builder /server/target/release/piano-backend /bin/piano-backend

ENV PORT 5000
EXPOSE 5000

CMD /bin/piano-backend

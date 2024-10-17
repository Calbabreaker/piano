FROM rust:1.81 AS builder

# Create a 
WORKDIR /server

# Create an empty project to cache dependencies
RUN cargo init --bin
COPY Cargo.toml Cargo.lock ./
RUN cargo build --release
RUN rm -rf ./src
RUN rm ./target/release/piano-backend

# Copy the source files
COPY ./src ./src

RUN cargo build --release

# Use a slim image for running
FROM debian:bookworm-slim

COPY --from=builder /server/target/release/piano-backend /bin/piano-backend

ENV PORT 5000
EXPOSE 5000

CMD /bin/piano-backend

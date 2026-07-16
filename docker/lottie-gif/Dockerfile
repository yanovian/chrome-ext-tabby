# Tabby Lottie → GIF via dotlottie-web (PNG frames) + gifski.
# Build from repo root: docker build -f docker/lottie-gif/Dockerfile -t tabby-lottie-gif:9 .
FROM rust:1-bookworm AS gifski-builder
RUN cargo install gifski --locked --version 1.33.0

FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    libcairo2 \
    libpango-1.0-0 \
    libjpeg62-turbo \
    libgif7 \
    librsvg2-2 \
  && rm -rf /var/lib/apt/lists/*

COPY --from=gifski-builder /usr/local/cargo/bin/gifski /usr/local/bin/gifski

WORKDIR /app
COPY docker/lottie-gif/package.json docker/lottie-gif/package-lock.json ./
RUN npm ci --omit=dev

COPY docker/lottie-gif/convert.mjs ./
COPY utils/lottie-gif-frames.mjs ./utils/lottie-gif-frames.mjs

ENTRYPOINT ["node", "convert.mjs"]

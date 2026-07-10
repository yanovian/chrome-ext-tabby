# Tabby Lottie → GIF via dotlottie-web + gifenc.
# Build from repo root: docker build -f docker/lottie-gif/Dockerfile -t tabby-lottie-gif:4 .
FROM oven/bun:1.2.23

WORKDIR /app
COPY docker/lottie-gif/package.json docker/lottie-gif/bun.lock ./
RUN bun install --frozen-lockfile

COPY docker/lottie-gif/convert.mjs ./
COPY utils/gif-alpha-encode.mjs ./gif-alpha-encode.mjs

ENTRYPOINT ["bun", "convert.mjs"]

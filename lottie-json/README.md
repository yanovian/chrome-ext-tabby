# Lottie source clips (not shipped)

Tabby mood animations as **Lottie JSON** for editing and export.

## Regenerate

```bash
pnpm animations
```

Writes `lottie-json/{newborn,playful,adult}/*.json`.

## Convert to GIF (Docker)

```bash
pnpm gif:convert
```

Uses the pinned image `tabby-lottie-gif:4` (`@lottiefiles/dotlottie-web` + gifenc in Docker). Requires **Docker**. Output lands in `public/gif/` at **60 fps** by default, rendered **2×** then downsampled for quality.

Or both steps:

```bash
pnpm animations:ship
```

See `docker/lottie-gif/README.md` for image pinning and options.

## Manual export

You can still convert JSON to GIF yourself and place files under `public/gif/{stage}/`. See `public/gif/README.md`.

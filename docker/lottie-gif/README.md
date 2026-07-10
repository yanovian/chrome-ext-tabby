# Lottie → GIF (Docker)

Local converter: **dotlottie-web** renders transparent PNG frames, then **gifski** builds the GIF with temporal palettes (no color flicker).

MP4 is not used in the middle step because H.264 MP4 cannot keep a transparent background. PNG → gifski matches the approach recommended for flicker-free GIFs.

## Quick use

```bash
pnpm animations      # write lottie-json/
pnpm gif:convert     # build image if needed → public/gif/
```

Makefile: `make animations`, then `make gif-convert`.

Or both in one step: `pnpm animations:ship` / `make animations-ship`.

**After JSON changes**, always run `gif:convert` (or `animations:ship`) so `public/gif/` matches `lottie-json/`.

## Image

Default: `tabby-lottie-gif:8`, built automatically on first `pnpm gif:convert`.

Rebuild:

```bash
docker build -t tabby-lottie-gif:8 -f docker/lottie-gif/Dockerfile .
```

## Pipeline (inside the container)

1. **dotlottie-web** + canvas — Lottie JSON → `frame-0001.png`, … at 150×150 with transparent background
2. **gifski** — PNG sequence → GIF with a shared temporal palette

## Options

| Env / flag | Default | Meaning |
|------------|---------|---------|
| `TABBY_GIF_FPS` | `0` | `0` = native Lottie `fr` (~30); set e.g. `30` to override |
| `TABBY_GIF_SCALE` | `1` | Render scale before downsample (`2` = sharper edges, slower) |
| `TABBY_GIFSKI_QUALITY` | `100` | Gifski quality 1–100 |
| `--stage adult` | all stages | Convert one life stage only |
| `--dry-run` | off | Print docker steps only |

Every stage exports at **150×150**. The overlay scales clips by life stage in CSS.

## Requirements

- Docker (first build compiles gifski from source and installs npm packages; slower once)

## Notes

- `peek_duck.gif` uses gifski `--once` (play a single time).
- Override the image tag with `TABBY_LOTTIE_GIF_IMAGE` for custom builds.

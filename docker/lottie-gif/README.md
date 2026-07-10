# Lottie → GIF (Docker)

Experimental converter: **@lottiefiles/dotlottie-web** + gifenc in Docker (same renderer family as the [Lottiefiles online tool](https://lottiefiles.com/tools/lottie-to-gif)).

## Shipped assets today

**`public/gif/` is maintained manually** via [Lottiefiles Lottie to GIF](https://lottiefiles.com/tools/lottie-to-gif). See [`public/gif/README.md`](../../public/gif/README.md).

Do **not** run `pnpm gif:convert` unless you intend to overwrite those files.

## Quick use (when experimenting)

```bash
pnpm animations      # write lottie-json/
pnpm gif:convert     # build image if needed → public/gif/
```

Or both: `pnpm animations:ship`.

## Image

Default: `tabby-lottie-gif:4`, built automatically on first `pnpm gif:convert`.

Rebuild:

```bash
docker build -t tabby-lottie-gif:4 -f docker/lottie-gif/Dockerfile .
```

## Options

| Env / flag | Default | Meaning |
|------------|---------|---------|
| `TABBY_GIF_FPS` | `60` | Output fps; upsamples from Lottie source (~30) with interpolation |
| `TABBY_GIF_SCALE` | `2` | Render scale before downsample (smoother edges) |
| `TABBY_GIF_COLORS` | `256` | Shared GIF palette size |
| `--stage adult` | all stages | Convert one life stage only |
| `--dry-run` | off | Print docker steps only |

Docker output uses per-stage Lottie canvas sizes: newborn **140**, playful **180**, adult **220**.

## TODO: match Lottiefiles web output

The Docker pipeline is **not** the source of shipped GIFs yet. Before switching:

1. **Visual parity** with [lottiefiles.com/tools/lottie-to-gif](https://lottiefiles.com/tools/lottie-to-gif): transparent background, smooth motion, no flicker or halos.
2. **Export sizing**: support a single **150×150** export (like the web tool’s “Small”) *or* per-stage sizes that match `COMPANION_CANVAS_SIZE`, with the overlay scaling documented in `utils/companion-animation.ts`.
3. **Stability**: reliable conversion on macOS Docker (retries are a workaround today).
4. **Validation**: side-by-side compare Docker vs Lottiefiles on `idle`, `peek`, and `overwhelmed` before replacing `public/gif/`.

Reference web settings: transparent background, **150×150** resolution, loop on.

## Notes

- GIFs play at **60 fps** by default (interpolated from ~30 fps Lottie).
- Each clip is rendered at **2×** resolution, then downsampled for clean edges.
- A **single shared 256-color palette** from all frames keeps colors steady.

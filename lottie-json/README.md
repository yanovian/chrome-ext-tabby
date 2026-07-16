# Lottie source clips (not shipped)

Tabby mood animations as **Lottie JSON** for editing and export.

## Regenerate JSON

```bash
pnpm animations
# or: make animations
```

Writes `lottie-json/{newborn,playful,adult}/*.json`.

Lottie canvas sizes per stage: newborn **140**, playful **180**, adult **220** (see `utils/companion-animation.ts` `COMPANION_CANVAS_SIZE`). Shipped GIFs are always **150×150**; the overlay scales by life stage.

## Ship GIFs

If you changed or regenerated JSON, run GIF conversion **next** so `public/gif/` stays in sync:

```bash
pnpm gif:convert
# or: make gif-convert
```

Uses Docker image `tabby-lottie-gif:9` (dotlottie-web + gifski). See [`public/gif/README.md`](../public/gif/README.md) and `docker/lottie-gif/README.md`.

**Warning:** this **overwrites** `public/gif/`.

### Both steps

```bash
pnpm animations:ship
# or: make animations-ship
```

Runs `animations` then `gif:convert` in order.

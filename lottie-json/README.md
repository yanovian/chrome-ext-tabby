# Lottie source clips (not shipped)

Tabby mood animations as **Lottie JSON** for editing and export.

## Regenerate JSON

```bash
pnpm animations
```

Writes `lottie-json/{newborn,playful,adult}/*.json`.

Lottie canvas sizes per stage: newborn **140**, playful **180**, adult **220** (see `utils/companion-animation.ts` `COMPANION_CANVAS_SIZE`).

## Ship GIFs (manual, current workflow)

**Today:** convert JSON to GIF with the [Lottiefiles Lottie to GIF](https://lottiefiles.com/tools/lottie-to-gif) website, then place files under `public/gif/{stage}/`. Full steps and settings are in [`public/gif/README.md`](../public/gif/README.md).

The Lottiefiles tool exports **150×150 px** for every stage. The extension scales clips by life stage in the overlay CSS.

## Automated conversion (Docker, not used for shipped assets yet)

```bash
pnpm gif:convert
```

Uses image `tabby-lottie-gif:4`. See `docker/lottie-gif/README.md`.

**Warning:** this **overwrites** `public/gif/`. Do not run it while relying on manual Lottiefiles exports unless you mean to replace them.

`pnpm animations:ship` runs JSON generation and Docker conversion together.

## Later

Improve `pnpm gif:convert` so Docker output matches Lottiefiles quality (transparent background, smooth motion, sensible per-stage sizing). Tracked in `docker/lottie-gif/README.md`.

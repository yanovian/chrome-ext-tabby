# Tabby GIF animations (shipped)

The extension loads these **animated GIFs** on web pages.

## Regenerate from Lottie JSON

**Two steps** when JSON changes: generate source clips, then convert to GIF.

```bash
make animations    # 1. write lottie-json/{stage}/
make gif-convert   # 2. Docker → public/gif/{stage}/ (150×150, transparent)
```

**One command** for both steps:

```bash
make animations-ship
```

Docker runs **dotlottie-web** (transparent PNG frames) then **gifski** (temporal palette, less color flicker). See `docker/lottie-gif/README.md`.

| Setting | Value |
|---------|--------|
| Background | **transparent** |
| Resolution | **150 × 150** (every life stage) |
| Frame rate | **native Lottie** (~30 fps) |
| Loop | **on** (`peek.gif` and `peek_duck.gif` play once) |

The extension **scales by age in CSS** (`COMPANION_DISPLAY_SIZE` in `utils/companion-animation.ts`).

`make gif-convert` **overwrites** `public/gif/`. Requires Docker.

## Required files

Each stage needs one GIF per mood clip:

| File | Mood / moment |
|------|----------------|
| `idle.gif` | Calm |
| `happy.gif` | Happy |
| `curious.gif` | Curious |
| `eat.gif` | Hungry |
| `feeding.gif` | Eating |
| `stress.gif` | Stressed |
| `sleep.gif` | Sleepy |
| `groom.gif` | Grooming |
| `play.gif` | After play care |
| `playing.gif` | Play moment |
| `peek.gif` | Peek (loop) |
| `peek_duck.gif` | Peek hide (play once) |
| `overwhelmed.gif` | Overwhelmed |

Stages: `newborn`, `playful`, `adult` (**39 files** total).

## Manual export (optional)

You can still use [lottiefiles.com/tools/lottie-to-gif](https://lottiefiles.com/tools/lottie-to-gif) and save downloads as `public/gif/{stage}/{state}.gif`.

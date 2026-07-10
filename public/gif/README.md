# Tabby GIF animations (shipped)

The extension loads these **animated GIFs** on web pages.

## Generate from Lottie (recommended)

```bash
pnpm animations:ship
```

This regenerates `lottie-json/` and runs Docker conversion into `public/gif/`.

## Manual add or update

1. Edit or regenerate JSON: `pnpm animations` → `lottie-json/`.
2. Convert: `pnpm gif:convert` (Docker) or your own tool.
3. Files must live under `public/gif/{stage}/`.

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
| `peek_duck.gif` | Peek hide (prefer play once) |
| `overwhelmed.gif` | Overwhelmed |

Stages: `newborn`, `playful`, `adult` (39 files total).

Canvas sizes: newborn **140px**, playful **180px**, adult **220px**. Use a transparent background.

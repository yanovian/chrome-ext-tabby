# Tabby GIF animations (shipped)

The extension loads these **animated GIFs** on web pages.

## Current source: manual Lottiefiles export

Shipped GIFs were converted manually with the [Lottiefiles Lottie to GIF](https://lottiefiles.com/tools/lottie-to-gif) tool.

Recommended settings (match the online tool):

| Setting | Value |
|---------|--------|
| Background | **transparent** |
| Resolution | **Small 150 × 150** |
| Loop | **on** (except `peek_duck.gif`, play once if the tool allows) |

Steps:

1. Regenerate JSON if needed: `pnpm animations` → `lottie-json/{stage}/`.
2. Open [lottiefiles.com/tools/lottie-to-gif](https://lottiefiles.com/tools/lottie-to-gif).
3. Upload each `lottie-json/{stage}/{state}.json` (or paste JSON).
4. Use the settings above and download the GIF.
5. Save as `public/gif/{stage}/{state}.gif` (same basename as the JSON).

**Important:** the online tool exports every clip at **150×150 px**, regardless of life stage. Newborn, playful, and adult folders all use the same pixel dimensions. The extension **scales by age in CSS** so a kitten looks smaller and an adult cat looks larger (`COMPANION_DISPLAY_SIZE` in `utils/companion-animation.ts`).

Do **not** run `pnpm gif:convert` unless you intend to replace these files with Docker output.

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

## Automated conversion (future)

`pnpm gif:convert` (Docker) can rebuild GIFs from `lottie-json/`. Output quality and per-stage sizing still need work to match the Lottiefiles tool. See `docker/lottie-gif/README.md` (**TODO**).

```bash
pnpm animations:ship   # JSON + Docker GIFs (overwrites public/gif/)
```

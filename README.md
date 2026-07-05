# Tabby

[![CI](https://github.com/yanovian/chrome-ext-tabby/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/yanovian/chrome-ext-tabby/actions/workflows/ci.yml)
[![last contribution](https://img.shields.io/github/last-commit/yanovian/chrome-ext-tabby/master?label=last%20contribution)](https://github.com/yanovian/chrome-ext-tabby/commits/master)

**A cat lives in your browser.**

> **[How to use Tabby →](./_doc/tutorial.md)**

Tabby floats on the pages you visit, reacts to what you read, and remembers your
online life together — privately, on your device. No cloud. No accounts. No guilt.

> You hop from a recipe blog to your notes, then a news site. Tabby comes along,
> remembers the places you explore together, and might say hello if she missed you.
> You choose when she appears: on one page, on every page, or tucked away during
> quiet hours.

## Why Tabby

Most browser extensions want to optimize your workflow. Tabby doesn't. She is a
**gentle companion** — a small cat who lives in your tabs, reacts to your browsing,
and grows over time. Everything stays local.

## Features

- **Floating cat companion** — Tabby appears on pages you visit. Drag her anywhere.
- **Mood-aware care menu** — tap Tabby to pet, feed, play, or ask what's up.
- **Local browsing memory** — tab titles, URLs, and optional page text are classified on-device to shape her mood and memories.
- **Three life stages** — newborn kitten → playful kitten → grown-up cat, each with its own sprites.
- **Quiet hours** — unprompted speech stays off during the hours you choose.
- **Show / hide controls** — hide Tabby on this page, on every page, or bring her back with one click.
- **Optional local speech** — short lines from a bundled on-device model, with hand-written fallbacks.
- **Export & delete** — your data stays in the browser; wipe it from settings when you want.

## Permissions

| Permission | Why |
|------------|-----|
| `tabs` | Know which tab is active and read its title/URL for the cat simulation |
| `storage` | Save settings, cat state, and per-page hide preferences locally |
| `alarms` | Run a gentle once-per-minute care tick while you browse |
| `scripting` | Reserved for best-effort inject into already-open tabs (usually a no-op without host permissions) |
| `offscreen` | Run the bundled local speech model without blocking the service worker |

Tabby runs on web pages via a **manifest content script** (not `host_permissions`). The cat and optional page text reading load on normal navigation. Tabs that were already open at install may need a **refresh** once.

Cat progress, browsing observations, and memories live in **IndexedDB** on your device.

**No broad host permissions. No backend. No analytics. No data uploaded.**

**Privacy policy:** [PRIVACY.md](./PRIVACY.md) — we do not collect data; everything stays local on your device.  
Public URL for the Chrome Web Store: https://github.com/yanovian/chrome-ext-tabby/blob/master/PRIVACY.md

## Quick start (development)

```bash
pnpm install
pnpm dev
```

1. Browse any normal web page — Tabby appears in the corner.
2. Click the **Tabby icon** in the toolbar for settings, or tap the cat on the page to interact.

After install or update, **refresh tabs that were already open** so Tabby can appear there too.

See **[How to use Tabby →](./_doc/tutorial.md)** for a short walkthrough with screenshots.

Keep `pnpm dev` running for hot reload. WXT opens a Chrome window with Tabby loaded from `.output/chrome-mv3-dev`. Use **Alt+R** in that window to reload manually if needed.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Dev server with hot reload |
| `pnpm build` | Production build (Chrome) |
| `pnpm zip` | Create Chrome Web Store zip |
| `pnpm icons` | Regenerate icons from `scripts/generate-icons.py` |
| `pnpm locales` | Regenerate `_locales/*/messages.json` from `scripts/generate-locales.mjs` |
| `pnpm sprites` | Strip sprite backgrounds / optimize PNGs |
| `pnpm test` | Run unit tests |
| `pnpm typecheck` | TypeScript check |

A `Makefile` wraps the same tasks (`make check`, `make package`, `make release-patch`, …). Run `make help` for the full list.

## Localization

The store description and toolbar tooltip are translated into ~40 languages via
Chrome's `_locales` system. The browser shows the right language automatically
based on the user's UI language, falling back to English (`default_locale`). The
extension **name** stays "Tabby" everywhere (it's a brand).

Translations live in [`scripts/generate-locales.mjs`](./scripts/generate-locales.mjs).
Run `pnpm locales` to regenerate `public/_locales/`. Locale files run automatically
before every `dev`/`build`/`zip` (via `pnpm assets`).

Long-form store copy per language: [`_doc/store-listing.md`](./_doc/store-listing.md).

## How it works

1. **Appear** — a content script renders Tabby on pages you visit (when not hidden).
2. **Observe** — the background worker tracks the active tab's title and URL, and optionally a short page text snippet, all on-device.
3. **React** — browsing updates Tabby's hunger, happiness, stress, and mood; she may speak or ask for care.
4. **Remember** — topic memories and observations stay in IndexedDB so she can recall places you've been together.

## On-device AI

Optional speech lines are generated by a **small bundled text model** (`flan-t5-small` via
[Transformers.js](https://huggingface.co/docs/transformers.js) + ONNX) in an offscreen
document. **No network calls at runtime** — the model and WebAssembly runtime ship inside
the extension package (same pattern as [Breadcrumb](https://github.com/yanovian/chrome-ext-breadcrumb)).

- Toggle **Varied local speech** in settings to use the bundled model (with curated fallbacks when needed)
- First load may take a few seconds while the model warms up
- Turn it off to skip AI entirely and use hand-written lines only

## Tech stack

- [WXT](https://wxt.dev/) — Manifest V3 extension framework (TypeScript + Vite)
- [Transformers.js](https://huggingface.co/docs/transformers.js) — on-device speech (`flan-t5-small`)
- IndexedDB + `chrome.storage.local` — local cat state and settings
- [Vitest](https://vitest.dev/) — unit tests
- GitHub Actions — CI on PR/push, releases on version tags

## License

MIT

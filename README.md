# Tabby

[![CI](https://github.com/yanovian/chrome-ext-tabby/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/yanovian/chrome-ext-tabby/actions/workflows/ci.yml)
[![last contribution](https://img.shields.io/github/last-commit/yanovian/chrome-ext-tabby/master?label=last%20contribution)](https://github.com/yanovian/chrome-ext-tabby/commits/master)

**A cat lives in your browser.**

> **[How to use Tabby →](./_doc/tutorial.md)**

Tabby floats on the pages you visit, reacts from the active tab title and URL, and remembers your
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
- **Local browsing memory** — title and URL only (known sites + keywords). No page body text. Mood shifts after 1+ minute on a page.
- **Three life stages** — newborn kitten → playful kitten → grown-up cat, each with its own **Lottie** animations (idle, happy, sleepy, and more).
- **Quiet hours** — unprompted speech stays off during the hours you choose.
- **Show / hide controls** — hide Tabby on this page, on every page, or bring her back with one click.
- **Do not disturb** — hide Tabby on every tab for 30 minutes, 1 hour, or until end of today.

## Permissions

| Permission | Why |
|------------|-----|
| `tabs` | Read the **active tab's title and URL** when you switch tabs or navigate — not your full browsing history |
| `storage` | Save settings, cat state, and per-page hide preferences locally |
| `alarms` | Once-per-minute care tick, plus short feeding and play timers |
| `scripting` | Reserved for best-effort inject into already-open tabs (usually a no-op without host permissions) |

Tabby runs on web pages via a **manifest content script** (not `host_permissions`). The cat loads on normal navigation. Tabs that were already open at install may need a **refresh** once.

**We do not request the `history` permission.** Tabby never reads your Chrome history, bookmarks, or closed tabs — only the page you are looking at right now.

Cat progress, browsing observations, and memories live in **IndexedDB** on your device. Settings, hide preferences, do not disturb, and overlay position use **`chrome.storage.local`**.

Clear Tabby's data from `chrome://extensions` → Tabby → Details → Clear data, or uninstall the extension.

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
| `pnpm animations` | Regenerate Lottie JSON cat clips in `public/animations/` |
| `pnpm test` | Run unit tests |
| `pnpm typecheck` | TypeScript check |

A `Makefile` wraps the same tasks (`make check`, `make package`, `make release-patch`, …). Run `make help` for the full list.

## Localization

The store description and toolbar tooltip are translated into ~40 languages via
Chrome's `_locales` system. The browser shows the right language automatically
based on the user's UI language, falling back to English (`default_locale`). The
extension **name** stays "Tabby" everywhere (it's a brand).

Translations live in [`scripts/generate-locales.mjs`](./scripts/generate-locales.mjs).
`public/_locales/` is **generated** (gitignored): `pnpm locales`, or automatically on
`pnpm install`, before `pnpm build` / `pnpm zip` (`prebuild` / `prezip` via `pnpm assets`),
and when you run `make build` or `make zip` (both call `assets` first).

Long-form store copy per language: [`_doc/store-listing.md`](./_doc/store-listing.md).

## How it works

1. **Appear** — a content script renders Tabby on pages you visit (when not hidden).
2. **Observe** — while a tab is active, the background worker reads only its **title and URL** (via the `tabs` permission). No page body, no browsing history.
3. **Classify** — a local pipeline guesses the vibe:
   - **Known sites first** — social feeds, dev docs (GitHub, Stack Overflow, AWS, …), YouTube (title + path heuristics), shopping, banking ([`utils/site-registry.ts`](./utils/site-registry.ts)).
   - **Title/URL keywords** — tutorials, gossip, login pages, etc.
4. **React** — after you stay on a page for **at least 1 minute**, and only if that path is **not** in the last **10** scored pages, Tabby gets a small mood nudge (+1 style: happiness, stress, hunger).
5. **Remember** — nourishing topics (e.g. Kubernetes) become memories in IndexedDB.
6. **Grow** — life stage advances by **calendar time**, not browsing.

### Why we read tabs at all

Tabby is a mood companion. She needs the active tab's title and URL so browsing can gently affect her feelings — not to track you.

| Signal | Used for | Read? |
|--------|----------|-------|
| Active tab **title + URL** | Site list → keywords → mood | Yes (`tabs`) |
| **Page body text** | — | **Never** |
| **Browsing history** | — | **Never** |
| **Time on page** | Must be ≥ 1 min before mood changes | Measured locally |

### Minimal access & anti-cheat

- **No `history` permission** — foreground tab only.
- **No broad `host_permissions`** — manifest content script for the cat UI only.
- **No page content reading** — title and URL are enough for known sites; YouTube uses the video title and `/shorts` vs `/watch` path.
- **1-minute dwell** — quick tab hops do not move mood.
- **Last-10 dedup** — revisiting the same path soon does not stack bonuses.

```text
Stay 1+ min on kubernetes.io/docs  →  nourishing  →  happiness +1, stress −1
Stay 1+ min on twitter.com/explore  →  draining  →  stress +1
Return to kubernetes.io/docs (still in last 10)  →  skipped
```

### What does *not* change with browsing

- **Life stage animations** (newborn / playful / adult) — real-world days together. Each stage uses bundled **[Lottie](https://lottiefiles.com/)** JSON clips played with [dotLottie Web](https://github.com/LottieFiles/dotlottie-web).
- **Unprompted speech limits** — quiet hours and daily caps are separate.

## Tech stack

- [WXT](https://wxt.dev/) — Manifest V3 extension framework (TypeScript + Vite)
- [Lottie](https://lottiefiles.com/) + [dotLottie Web](https://github.com/LottieFiles/dotlottie-web) — vector cat animations (`public/animations/`)
- IndexedDB + `chrome.storage.local` — local cat state and settings
- [Vitest](https://vitest.dev/) — unit tests
- GitHub Actions — CI on PR/push, releases on version tags

## License

MIT

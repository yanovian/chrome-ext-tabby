# <img src="./public/icon/48.png" alt="Tabby icon" width="38" height="38" valign="middle"> Tabby

[![CI](https://github.com/yanovian/chrome-ext-tabby/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/yanovian/chrome-ext-tabby/actions/workflows/ci.yml)
[![last contribution](https://img.shields.io/github/last-commit/yanovian/chrome-ext-tabby/master?label=last%20contribution)](https://github.com/yanovian/chrome-ext-tabby/commits/master)

**A cat lives in your browser.**

> **[⬇️ Install from the Chrome Web Store](https://chromewebstore.google.com/detail/tabby/bgjfofaekhihaeafccchijbakkhlcngb)**
>
> **[Marketing site →](https://yanovian.github.io/chrome-ext-tabby/)** · **[How to use Tabby →](./_doc/tutorial.md)**

Tabby is a **virtual pet** who keeps you company while you browse. She floats on the
pages you visit, reacts from the active tab title and web address, and grows from a
newborn kitten into an adult cat over real calendar days. Pet her, feed her treats,
play until she goes wild, and smile when she peeks in with a hungry grumble or a silly
line. Everything stays on your device: no accounts, no cloud, and no data sent anywhere.

> Picture an evening online. You drift from a shopping tab to a video, then a forum
> thread. Tabby comes along for the ride. She might say hello from the corner, ask for
> food when her belly is empty, or curl up after a long session. You choose when she
> appears: on one page, on every page, or tucked away during quiet hours.

## Why Tabby

Hours in the browser can feel strangely quiet. Tabby is **company in the tabs you
already have**: moods, a care menu, feeding and play scenes, and a cat who grows from
kitten to adult over real weeks and months.

Her mood shifts gently from the **title and web address** of your active tab, nothing
more. She never reads page text, never looks through your history, and never sends
data anywhere.

Busy? Snooze her for 30 minutes, an hour, or until the end of the day. Hide her on one
page or on every page whenever you want the screen to yourself.

## Features

- **Floating cat** — Tabby appears on pages you visit. Drag her anywhere.
- **Care menu** — tap Tabby to pet, feed, play, or ask what's up. She answers in a speech bubble.
- **Moods and needs** — hungry, happy, stressed, sleepy, and more, each with matching animations.
- **Feeding and play moments** — short scenes when you treat or play with her.
- **Three life stages** — newborn kitten, playful kitten, then adult cat, each with its own animation set.
- **Peeks and speech** — she may wander in from the edge or murmur a quiet line while you browse.
- **Memories** — places you visit together can echo back in things she says later.
- **Quiet hours** — unprompted speech stays off during the hours you choose.
- **Show / hide** — per page, on every page, or do not disturb for 30 minutes, 1 hour, or until end of today.

## Permissions

Tabby requests only four permissions, and no host permissions:

```json
{
  "permissions": ["tabs", "storage", "alarms", "scripting"]
}
```

| Permission | Why |
|------------|-----|
| `tabs` | Read the **active tab's title and URL** so browsing can gently affect her mood |
| `storage` | Save cat state, settings, and hide preferences locally |
| `alarms` | Once-per-minute care tick, plus short feeding and play timers |
| `scripting` | Best-effort inject into already-open tabs at install (usually a no-op without host permissions) |

Her mood, memories, and your settings are stored in **IndexedDB** and **`chrome.storage.local`**, on your device.

**No browsing history. No reading page text. No backend. No scary permissions.**

Privacy policy: [PRIVACY.md](./PRIVACY.md)

## Quick start (development)

```bash
pnpm install
pnpm dev
```

1. Open any normal web page. Tabby appears in the corner.
2. Tap the cat to pet, feed, or play. Click the **Tabby icon** in the toolbar for settings.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Dev server with hot reload |
| `pnpm build` | Production build (Chrome) |
| `pnpm zip` | Create Chrome Web Store zip |
| `pnpm icons` | Regenerate icons from `scripts/generate-icons.py` |
| `pnpm locales` | Regenerate `_locales/*/messages.json` from `scripts/generate-locales.mjs` |
| `pnpm animations` | Regenerate Lottie JSON source clips in `lottie-json/` |
| `pnpm gif:convert` | Docker Lottie→GIF via dotlottie-web + gifski (see `public/gif/README.md`) |
| `pnpm animations:ship` | Regenerate JSON and Docker GIF in one step |

After **`pnpm animations`** (or `make animations`), run **`pnpm gif:convert`** (or `make gif-convert`) so shipped GIFs in `public/gif/` match the new JSON. Or use **`pnpm animations:ship`** / **`make animations-ship`** for both steps.

| `pnpm test` | Run unit tests |
| `pnpm typecheck` | TypeScript check |

A `Makefile` wraps the same tasks (`make check`, `make gif-convert`, `make animations-ship`, `make package`, `make release-patch`, …).

## Marketing site (GitHub Pages)

Source in [`website/`](./website/). Published at **https://yanovian.github.io/chrome-ext-tabby/** (shortest path for this repo: org pages + repo name only).

| Command | Description |
|---------|-------------|
| `make website-install` | Install website dependencies |
| `make website-dev` | Local dev with hot reload (`http://localhost:5173/`) |
| `make website-build` | Production build for GitHub Pages |
| `make website-preview` | Build and preview the Pages URL locally (`http://localhost:4173/chrome-ext-tabby/`) |
| `make website-clean` | Remove website `dist/` and copied assets |

Deploys automatically on push to `master` via [`.github/workflows/pages.yml`](./.github/workflows/pages.yml) when `website/`, extension GIFs/icons, or that workflow change. Enable **Settings → Pages → GitHub Actions** once on the repo.

## Localization

The store description and toolbar tooltip are translated into ~40 languages via
Chrome's `_locales` system. The browser shows the right language automatically
based on the user's UI language, falling back to English (`default_locale`). The
extension **name** stays "Tabby" everywhere (it's a brand).

All translations live in a single source file, [`scripts/generate-locales.mjs`](./scripts/generate-locales.mjs)
(the generated `public/_locales/` is git-ignored). It runs automatically before
every `dev`/`build`/`zip` (via `pnpm assets`), so a package can never ship without
its locale files. To add or edit a language, update the script and run `pnpm locales`.

## How it works

1. **Appear** — a content script renders Tabby on the active tab when she is not hidden. She does not run on some sensitive sites (see `utils/overlay-excluded-hosts/`).
2. **Notice** — the background worker reads only the **title and URL** of the page you are on.
3. **React** — after about a minute on a page, her mood shifts; pet, feed, and play can trigger short animation moments.
4. **Grow** — life stage advances by calendar days since adoption; memories from earlier visits can surface in speech.

See [`_doc/architecture.md`](./_doc/architecture.md) for the full technical design.

## Local-only companion

Animations, speech lines, and mood rules run entirely in your browser. Everything ships
**inside the extension package**, so Tabby makes **no network request at all** at
runtime: she works fully offline, and nothing about your browsing is uploaded anywhere.

## Tech stack

- [WXT](https://wxt.dev/) — Manifest V3 extension framework (TypeScript + Vite)
- Animated **GIF** cat clips (`public/gif/`), built with `pnpm gif:convert` (dotlottie-web + gifski in Docker)
- IndexedDB + `chrome.storage.local` — local cat state and settings
- [Vitest](https://vitest.dev/) — unit tests
- GitHub Actions — CI on PR/push, releases on version tags, marketing site deploy
- [`website/`](./website/) — Vite + React landing page on GitHub Pages

## License

MIT

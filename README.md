# <img src="./public/icon/48.png" alt="Tabby icon" width="38" height="38" valign="middle"> Tabby

[![CI](https://github.com/yanovian/chrome-ext-tabby/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/yanovian/chrome-ext-tabby/actions/workflows/ci.yml)
[![last contribution](https://img.shields.io/github/last-commit/yanovian/chrome-ext-tabby/master?label=last%20contribution)](https://github.com/yanovian/chrome-ext-tabby/commits/master)

**A cat lives in your browser.**

> **[How to use Tabby →](./_doc/tutorial.md)**

Tabby is a **virtual pet** for people who spend time online and want a little company.
She floats on the pages you visit, reacts to how you browse, and grows from a newborn
kitten into an adult cat over real calendar days. Pet her, feed her treats, play with her,
and enjoy the small moments: a hungry grumble, a sleepy stretch, a silly line when she
peeks in from the corner. No account, no subscription, and nothing leaves your device.

> You open a shopping tab, then a video, then a forum thread. Tabby tags along. She might
> wander in for a quiet hello, ask for food when she is hungry, or curl up after a long
> session. When you want the screen to yourself, hide her on one page, on every page, or
> set quiet hours so unprompted chatter waits until morning.

## What Tabby is

A **virtual pet** that lives in your tabs. Tabby brings animated moods, a care menu,
feeding and play scenes, quiet peeks from the corner, and slow growth from kitten to
adult cat. She is there for company while you browse.

She glances at your **active tab title and web address** to nudge her mood. She never
reads page text, never reads your browsing history, and never sends data anywhere. You
choose when she appears.

## Features

- **Floating cat** — a draggable companion on the pages you visit, with smooth vector animations.
- **Care menu** — pet, feed, play, or ask what's up. Her reply appears in a speech bubble.
- **Moods and needs** — hungry, happy, stressed, sleepy, and more, each with matching animations.
- **Feeding and play moments** — short scenes when you treat or play with her.
- **Three life stages** — newborn kitten, playful kitten, then adult cat, each with its own animation set.
- **Peeks and speech** — she may step in from the edge or say a quiet line while you browse.
- **Memories** — nourishing places you visit together can come back in things she says later.
- **Quiet hours** — unprompted speech stays off during the hours you choose.
- **Show / hide** — per page, on every page, or **do not disturb** for 30 minutes, 1 hour, or until end of today.

## Permissions

Tabby requests four permissions, and no host permissions:

```json
{
  "permissions": ["tabs", "storage", "alarms", "scripting"]
}
```

| Permission | Why |
|------------|-----|
| `tabs` | Read the **active tab's title and URL** so browsing can gently affect her mood, not your full history |
| `storage` | Save cat state, settings, and hide preferences on your device |
| `alarms` | Once-per-minute care tick, plus short feeding and play timers |
| `scripting` | Best-effort inject into already-open tabs at install (usually a no-op without host permissions) |

The cat UI loads via a **manifest content script** (not `host_permissions`). Tabs that were already open at install may need a **refresh** once.

Cat vitals, memories, and browsing observations live in **IndexedDB** on your device. Settings, hide choices, and where you dragged her use **`chrome.storage.local`**.

Tabby does **not** request the `history` permission. She never reads bookmarks, closed tabs, or page body text. No backend, no analytics, no data uploaded.

Clear her data anytime: `chrome://extensions` → Tabby → Details → **Clear data**, or uninstall the extension.

Privacy policy: [PRIVACY.md](./PRIVACY.md)  
Public URL for the Chrome Web Store: https://github.com/yanovian/chrome-ext-tabby/blob/master/PRIVACY.md

## Quick start (development)

```bash
pnpm install
pnpm dev
```

1. Open any normal web page. Tabby appears in the corner.
2. Tap the cat to pet, feed, or play. Use the **Tabby icon** in the toolbar for settings.

After install or update, **refresh tabs that were already open** so Tabby can appear there too.

WXT loads the dev build into Chrome from `.output/chrome-mv3-dev`. Keep `pnpm dev` running for hot reload, or press **Alt+R** in that window to reload manually.

Contributor docs: [Architecture](./_doc/architecture.md) · [Release](./_doc/release.md)

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

A `Makefile` wraps the same tasks (`make check`, `make package`, `make release-patch`, …).

## Localization

The store description and toolbar tooltip are translated into ~40 languages via
Chrome's `_locales` system. The browser shows the right language automatically
based on the user's UI language, falling back to English (`default_locale`). The
extension **name** stays "Tabby" everywhere (it's a brand).

All translations live in a single source file, [`scripts/generate-locales.mjs`](./scripts/generate-locales.mjs)
(the generated `public/_locales/` is git-ignored). It runs automatically before
every `dev`/`build`/`zip` (via `pnpm assets`), so a package can never ship without
its locale files. To add or edit a language, update the script and run `pnpm locales`.

Long-form store copy per language: [`_doc/store-listing.md`](./_doc/store-listing.md).

## How it works

1. **Show up** — a content script draws Tabby on the active tab when she is not hidden.
2. **Notice the tab** — the background worker reads only the **title and URL** of the page you are on.
3. **Shift mood** — after about a minute on a page, and not if you just visited the same page recently, her vitals get a small bump up or down.
4. **Care** — pet, feed, and play run through the care menu and can trigger short animation moments.
5. **Remember** — topics from nourishing visits can surface later in things she says.
6. **Age** — life stage advances by **days since adoption**, not by how much you browse.
7. **Speak** — unprompted lines respect quiet hours, daily caps, and cooldowns you set in the popup.

See [`_doc/architecture.md`](./_doc/architecture.md) for classification rules, dedup gates, and the full technical design.

## Private by design

Animations, speech lines, and mood rules ship **inside the extension**. Tabby makes
**no network requests at runtime**: she works offline, and nothing about your browsing
is sent anywhere. There is no account and no analytics.

## Tech stack

- [WXT](https://wxt.dev/) — Manifest V3 extension framework (TypeScript + Vite)
- [Lottie](https://lottiefiles.com/) + [dotLottie Web](https://github.com/LottieFiles/dotlottie-web) — vector cat animations (`public/animations/`)
- IndexedDB + `chrome.storage.local` — local cat state and settings
- [Vitest](https://vitest.dev/) — unit tests
- GitHub Actions — CI on PR/push, releases on version tags

## License

MIT

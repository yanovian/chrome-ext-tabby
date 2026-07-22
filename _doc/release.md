# Release & Publishing Guide

This document covers local packaging, automated releases, and publishing Tabby to the Chrome Web Store.

## Versioning

The extension version comes from `package.json` (`version` field). WXT copies it into the generated manifest.

Use [Semantic Versioning](https://semver.org/):

- **PATCH:** bug fixes
- **MINOR:** new features, backward compatible
- **MAJOR:** breaking changes (rare; note anything users must redo in `CHANGELOG.md`)

### Changelog before you tag

`CHANGELOG.md` is for end users. Before each release:

1. Read the top section. If it is `## X.Y.Z (unreleased)`, remove `(unreleased)` when you ship that version.
2. If there is no unreleased section, add one for the next version while you develop.
3. Never edit bullets under a released version heading (no `(unreleased)`).

Example on ship: `## 2.0.1 (unreleased)` becomes `## 2.0.1`, then add `## 2.0.2 (unreleased)` at the top for ongoing work.

## Local build & zip

```bash
make install
make check          # typecheck + lint + test
make package         # assets + build + zip + verify output
```

Artifacts appear in `.output/`:

- `tabby-<version>-chrome.zip`

Load unpacked for manual QA:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select `.output/chrome-mv3`

Refresh tabs that were already open before install so the content script can attach.

## CI pipeline (`.github/workflows/ci.yml`)

Runs on:

- Push to `master`
- Pull requests targeting `master`

Steps:

1. `pnpm install --frozen-lockfile`
2. `pnpm locales`
3. `pnpm typecheck`
4. `pnpm lint`
5. `pnpm lint:extension-i18n`
6. `pnpm test`
7. `pnpm build`
8. `pnpm test:e2e`
9. `pnpm zip`
10. Upload `tabby-*-chrome.zip` as a GitHub Actions artifact

Use the artifact from a green PR build for manual store submission before tagging.

## Release pipeline (`.github/workflows/release.yml`)

Triggered by pushing a git tag matching `v*.*.*` (e.g. `v2.0.0`).

Steps:

1. Install dependencies
2. Generate locales
3. Run tests and lint
4. Build and zip Chrome package
5. Create a GitHub Release with the zip attached and auto-generated notes

### Creating a release

**Option A: Makefile (recommended)**

Runs the full check suite, bumps `package.json`, commits, tags `vX.Y.Z`, and pushes:

```bash
git checkout master
git pull

# Finalize CHANGELOG (remove "(unreleased)" from the version you are shipping)
git add CHANGELOG.md
git commit -m "Prepare release vX.Y.Z"   # if changelog changed

make release-patch   # or release-minor / release-major
```

**Option B: manual** (skips the check suite that `make release-patch` runs first)

```bash
git checkout master
git pull

pnpm version patch   # or minor / major; updates package.json and creates tag
git push origin master --follow-tags
```

The release workflow publishes the zip automatically.

## Chrome Web Store submission

### Prerequisites

1. [Chrome Web Store Developer account](https://chrome.google.com/webstore/devconsole) ($5 one-time fee)
2. A green CI build or local `make zip` artifact
3. Store listing assets:
   - Icon 128×128 (`public/icon/128.png`; run `make icons` to regenerate)
   - Screenshots (1280×800 recommended; see `_doc/tutorial.md`)
   - Short and detailed descriptions (`_doc/store-listing.md`, ~40 languages via `_locales`)
4. Privacy policy URL: [PRIVACY.md](https://github.com/yanovian/chrome-ext-tabby/blob/master/PRIVACY.md)

### Upload steps

1. Open the [Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. **New item** (first release) or select the existing Tabby listing
3. Upload `.output/tabby-<version>-chrome.zip`
4. Fill listing details:
   - **Name:** Tabby (brand name, same in every locale)
   - **Category:** Productivity or Fun (pick what fits your positioning)
   - **Privacy:** Single purpose, no remote code, no data collection
5. Declare permission justification:
   - `tabs`: read the **active tab title and URL** for local mood classification (not full history)
   - `storage`: save settings, cat state cache, hide preferences, and overlay position locally
   - `alarms`: once-per-minute care tick and short feeding/play timers
   - `scripting`: best-effort inject into already-open tabs at install (usually a no-op without host permissions)
6. Submit for review

### Review tips

- Emphasize **local-only** data: IndexedDB + `chrome.storage.local`, nothing uploaded.
- State clearly that Tabby **never reads page body text** or browsing history.
- Content script runs via **manifest registration**, not broad `host_permissions`.
- No analytics, accounts, or cloud inference.
- Provide a short screen recording: cat appears on a page, care menu (pet/feed/play), quiet hours or hide, toolbar popup settings.

## Post-release checklist

- [ ] `CHANGELOG.md` top section matches the shipped version (no `(unreleased)` on it)
- [ ] GitHub Release contains `tabby-<version>-chrome.zip`
- [ ] Install from store listing (unlisted first if desired)
- [ ] Smoke test: cat on active tab, drag position, speech bubble, care menu
- [ ] Smoke test: hide on page, do not disturb, show again from popup
- [ ] Smoke test: dwell ~1 min on a trackable page, confirm mood nudge (dev mode speeds this up)
- [ ] Toolbar badge clears after dismissing speech
- [ ] `PRIVACY.md` **Last updated** date is current if permissions or data handling changed this release

## Rollback

Chrome Web Store:

1. Developer Dashboard → your item → **Package**
2. Roll back to a previous approved version if a regression ships

Git:

```bash
git tag -d v2.0.1                    # local only
git push origin :refs/tags/v2.0.1    # delete remote tag if needed
```

Prefer forwarding fixes with a new patch tag instead of rewriting published tags.

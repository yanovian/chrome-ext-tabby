# Privacy Policy — Tabby

**Last updated:** July 6, 2026

**Privacy policy URL (for Chrome Web Store):**
https://github.com/yanovian/chrome-ext-tabby/blob/master/PRIVACY.md

## Summary

**Tabby does not collect your data.** There is no account, no analytics server, and no
cloud AI. Everything Tabby knows stays **on your device**, inside your browser.

Tabby reads only the **active tab's title and URL** while you browse. She never reads page
body text, never reads your browsing history, and never uploads anything.

## What Tabby reads

- **Active tab title and URL** — when a tab is in the foreground (`tabs` permission)
- **Not read:** page HTML or visible text, browsing history, bookmarks, closed tabs,
  clipboard, or form fields

Classification uses local site lists, title/URL keywords, and optionally the bundled
on-device model. Mood changes only after you stay on a page for at least one minute.

## What Tabby stores locally

- **Cat state** — hunger, happiness, stress, energy, age, mood (IndexedDB)
- **Browsing observations** — title, URL, hostname, local category (IndexedDB)
- **Recent visit keys** — last 10 page paths for dedup (`chrome.storage.local`)
- **Memories** — topic summaries Tabby can recall (IndexedDB)
- **Settings** (`chrome.storage.local`)

You can export or delete this data from the settings popup.

## What we do not do

- Read page content or DOM text
- Read Chrome browsing history
- Operate a backend that receives browsing data
- Use cloud AI or send pages to third parties
- Sell data — we never receive it
- Use remote code at runtime

## Permissions

| Permission | Why |
|------------|-----|
| `tabs` | Active tab title and URL only — not history |
| `storage` | Cat state, visit dedup, settings |
| `alarms` | Minute tick for dwell scoring and passive care |
| `scripting` | Best-effort inject into already-open tabs |
| `offscreen` | Bundled local model (speech + classification) |

**Page access:** manifest content script for the floating cat — not broad `host_permissions`.

## Contact

Tabby is open source. Questions and issues belong in the project repository.

# Tabby marketing site

Landing page for [Tabby](https://github.com/yanovian/chrome-ext-tabby). Vite + React + TypeScript.

**Live URL:** https://yanovian.github.io/chrome-ext-tabby/

## Commands (from repo root)

| Make | What it does |
|------|----------------|
| `make website-install` | Install `website/` dependencies |
| `make website-dev` | Dev server at http://localhost:5173/ (base `/`) |
| `make website-build` | Production build to `website/dist/` |
| `make website-preview` | Build + preview at http://localhost:4173/chrome-ext-tabby/ |
| `make website-clean` | Remove `dist/` and copied `public/` assets |

## Commands (this folder)

```bash
pnpm install
pnpm dev          # localhost:5173, base /
pnpm lint-i18n      # locale keys must match en/ (no missing, no extra)
pnpm lint-i18n-fix  # add missing keys as "" in other locales
pnpm build        # lint-i18n, then uses .env.production → /chrome-ext-tabby/
pnpm preview      # after build; pass --base /chrome-ext-tabby/ for Pages paths
```

Assets copy from extension `public/` and `lottie-json/` on `predev` and `prebuild`. Committed share images live in `static/og-image.png` and `static/og/*.png` (copied into `public/`). Regenerate with `pnpm og-images` after SEO copy changes.

**SEO:** `@unhead/react` + `@unhead/schema-org` in `src/components/SiteHead.tsx`, copy in `src/locales/*/seo.json`. `scripts/prerender-locale-html.mjs` writes a static HTML shell per locale and route (e.g. `/fa/`) so view-source and no-JS crawlers see localized meta on GitHub Pages. English stays at `/`; other locales use a `/{code}/` prefix.

**Languages:** 38 locales in `src/locales/<code>/` (`marketing.json`, `common.json`, `legal.json`, `seo.json`). Same set as the Chrome Web Store (`src/i18n/locales.ts`). RTL for `ar` and `fa`. Edit English in `src/locales/en/`, run `pnpm lint-i18n-fix` to sync keys, translate, then `pnpm lint-i18n`. Bundled into the production build via `import.meta.glob`.

## GitHub Pages

1. Repo **Settings → Pages → Build and deployment → Source:** choose **GitHub Actions**.
2. Push to `master` or run the **Deploy website** workflow manually.

Deploy workflow: `.github/workflows/pages.yml` (Node 24, `deploy-pages@v5`).

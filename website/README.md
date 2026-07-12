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
pnpm build        # uses .env.production → /chrome-ext-tabby/
pnpm preview      # after build; pass --base /chrome-ext-tabby/ for Pages paths
```

Assets copy from extension `public/` and `lottie-json/` on `predev` and `prebuild` (`scripts/copy-assets.mjs`). Clips play as **Lottie** via `@lottiefiles/dotlottie-web` (same renderer as the GIF pipeline), not `lottie-web`.

## GitHub Pages

1. Repo **Settings → Pages → Build and deployment → Source:** choose **GitHub Actions**.
2. Push to `master` or run the **Deploy website** workflow manually.

Deploy workflow: `.github/workflows/pages.yml` (Node 24, `deploy-pages@v5`).

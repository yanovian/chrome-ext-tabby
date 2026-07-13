# Browser E2E (Playwright)

```bash
pnpm test:e2e
# or
make test-e2e
```

`pretest:e2e` builds a **development** extension (dev menu enabled), installs Chromium, then runs Playwright. No manual setup.

## What is covered

- `e2e/peek-layout.spec.ts`: real Chromium layout for bottom/left/right peek (rotation + visibility)
- `e2e/extension-peek.spec.ts`: unpacked extension on `example.com`, dev peek override, peek on screen, click-to-reveal restores the previous real mood

Vitest covers orchestration math in `tests/overlay-position.test.ts`, `tests/peek-overlay-layout.test.ts`, and `tests/orchestrator.test.ts`.

## Generated files (gitignored)

Playwright writes these under the repo root; they are listed in `.gitignore`:

- `test-results/` (traces, screenshots, `.last-run.json`)
- `playwright-report/` (HTML report from failed runs)
- `blob-report/` (blob merge output, if used)
- `playwright/.cache/` (browser downloads cache when configured)

Peek shows about half of Tabby by design. After tap-to-reveal, the full sprite uses a `catSize × catSize` root.

## Layout helpers

`e2e/helpers/overlay-layout.ts` mirrors `utils/overlay-position.ts` peek functions only. E2E must not import from `utils/` (that chain pulls `locales/en.json` and breaks Playwright's loader).

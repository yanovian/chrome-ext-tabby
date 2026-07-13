import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  outputDir: 'test-results',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    {
      name: 'layout',
      testMatch: '**/peek-layout.spec.ts',
      use: { browserName: 'chromium' },
    },
    {
      name: 'extension',
      testMatch: '**/extension-peek.spec.ts',
      use: {
        browserName: 'chromium',
        // MV3 extension overlays need a real browser profile (headed + Xvfb on CI).
        headless: false,
      },
    },
  ],
});

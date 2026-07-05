import { readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'wxt';

function removeRedundantWasm(dir: string): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      removeRedundantWasm(full);
    } else if (/[/\\]assets[/\\]ort-wasm-.*\.wasm$/.test(full)) {
      rmSync(full);
      console.log(`ℹ Removed redundant bundled copy: ${entry}`);
    }
  }
}

export default defineConfig({
  hooks: {
    'build:done'(wxt) {
      // Dev rebuilds must keep bundled WASM reachable; strip duplicates on release only.
      if (wxt.config.command === 'serve') {
        return;
      }
      removeRedundantWasm(wxt.config.outDir);
    },
  },
  manifest: {
    name: 'Tabby',
    short_name: 'Tabby',
    description:
      'A cat lives in your browser. Tabby reacts to what you browse — privately, on your device.',
    permissions: ['tabs', 'storage', 'alarms', 'scripting', 'offscreen'],
    host_permissions: ['<all_urls>'],
    action: {
      default_title: 'Tabby — settings',
    },
    web_accessible_resources: [
      {
        resources: ['sprites/*/*.png'],
        matches: ['<all_urls>'],
      },
    ],
    content_security_policy: {
      extension_pages:
        "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
    },
  },
  zip: {
    name: 'tabby',
  },
  webExt: {
    startUrls: ['https://www.google.com'],
  },
  dev: {
    reloadCommand: 'Alt+R',
  },
});

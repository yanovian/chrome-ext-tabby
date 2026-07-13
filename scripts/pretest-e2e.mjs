#!/usr/bin/env node
/**
 * Runs before `pnpm test:e2e`: build the extension and ensure Chromium is installed.
 * CI sets PLAYWRIGHT_INSTALL_DEPS=1 for system libraries on Linux.
 */
import { spawnSync } from 'node:child_process';

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: false });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run('pnpm', ['build:dev']);

const installArgs = ['playwright', 'install', 'chromium'];
if (process.env.PLAYWRIGHT_INSTALL_DEPS === '1') {
  installArgs.push('--with-deps');
}

run('pnpm', ['exec', ...installArgs]);

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COMPANION_GIF_SOURCE_SIZE } from '../utils/companion-animation';

const PINNED_DOCKER_IMAGE = 'tabby-lottie-gif:8';
const DOCKERFILE_DIR = 'docker/lottie-gif';

describe('lottie gif conversion', () => {
  it('documents a pinned local Docker image tag', () => {
    expect(PINNED_DOCKER_IMAGE).toBe('tabby-lottie-gif:8');
  });

  it('builds from the docker/lottie-gif Dockerfile', () => {
    expect(existsSync(join(process.cwd(), DOCKERFILE_DIR, 'Dockerfile'))).toBe(true);
    expect(existsSync(join(process.cwd(), DOCKERFILE_DIR, 'convert.mjs'))).toBe(true);
    expect(existsSync(join(process.cwd(), DOCKERFILE_DIR, 'package.json'))).toBe(true);
  });

  it('documents companion GIF source size for exports', () => {
    expect(COMPANION_GIF_SOURCE_SIZE).toBe(150);
  });

  it('has Lottie JSON sources for each shipped stage', () => {
    const root = process.cwd();
    for (const stage of ['newborn', 'playful', 'adult'] as const) {
      const sourceDir = join(root, 'lottie-json', stage);
      if (!existsSync(sourceDir)) {
        continue;
      }
      const jsonFiles = readdirSync(sourceDir).filter((name) => name.endsWith('.json'));
      expect(jsonFiles).toContain('idle.json');
      expect(jsonFiles).toContain('peek_duck.json');
    }
  });
});

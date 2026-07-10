import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Pin by tag; override with TABBY_LOTTIE_GIF_IMAGE for a custom build. */
export const LOTTIE_GIF_DOCKER_IMAGE =
  process.env.TABBY_LOTTIE_GIF_IMAGE ?? 'tabby-lottie-gif:4';

export const LOTTIE_GIF_DOCKERFILE_DIR = 'docker/lottie-gif';

/** Must match utils/companion-animation.ts COMPANION_CANVAS_SIZE. */
export const LOTTIE_GIF_STAGE_SIZE = {
  newborn: 140,
  playful: 180,
  adult: 220,
};

export const LOTTIE_GIF_STAGES = Object.keys(LOTTIE_GIF_STAGE_SIZE);

function jsonFilesIn(dir) {
  return readdirSync(dir).filter((name) => name.endsWith('.json'));
}

export function convertStagePlan(stage, root) {
  const sourceDir = join(root, 'lottie-json', stage);
  const outputDir = join(root, 'public', 'gif', stage);
  const size = LOTTIE_GIF_STAGE_SIZE[stage];
  return {
    stage,
    sourceDir,
    outputDir,
    size,
    jsonFiles: existsSync(sourceDir) ? jsonFilesIn(sourceDir) : [],
  };
}

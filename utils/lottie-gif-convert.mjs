import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Pin by tag; override with TABBY_LOTTIE_GIF_IMAGE for a custom build. */
export const LOTTIE_GIF_DOCKER_IMAGE =
  process.env.TABBY_LOTTIE_GIF_IMAGE ?? 'tabby-lottie-gif:8';

export const LOTTIE_GIF_DOCKERFILE_DIR = 'docker/lottie-gif';

/** Shipped GIF size for every life stage (Lottiefiles "Small 150×150"). */
export const TABBY_GIF_EXPORT_SIZE = 150;

/** Lottiefiles exports every stage at 150×150; overlay scales by age in CSS. */
export const LOTTIE_GIF_STAGE_SIZE = {
  newborn: TABBY_GIF_EXPORT_SIZE,
  playful: TABBY_GIF_EXPORT_SIZE,
  adult: TABBY_GIF_EXPORT_SIZE,
};

export const LOTTIE_GIF_STAGES = Object.keys(LOTTIE_GIF_STAGE_SIZE);

/** Target output fps. 0 = read native `fr` from each Lottie JSON file. */
export const TABBY_GIF_DEFAULT_FPS = 0;

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

/** Rename Lottiefiles download names (e.g. idle.json.gif) to shipped names (idle.gif). */
export function normalizeLottiefilesGifName(fileName, jsonBasename) {
  const expected = `${jsonBasename}.gif`;
  if (fileName === expected) {
    return expected;
  }
  const suffixes = [
    `${jsonBasename}.json.gif`,
    `${jsonBasename}.lottie.gif`,
    'animation.gif',
    'output.gif',
  ];
  if (suffixes.includes(fileName)) {
    return expected;
  }
  if (fileName.endsWith('.gif') && fileName.startsWith(jsonBasename)) {
    return expected;
  }
  return null;
}

import { cpSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const websiteRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(websiteRoot, '..');
const repoPublic = join(repoRoot, 'public');
const lottieRoot = join(repoRoot, 'lottie-json');
const outPublic = join(websiteRoot, 'public');

const gifAssets = [
  ['icon/128.png', 'icon.png'],
  ['icon/48.png', 'icon-48.png'],
  ['gif/adult/happy.gif', 'gif/happy.gif'],
  ['gif/adult/idle.gif', 'gif/idle.gif'],
  ['gif/adult/feeding.gif', 'gif/feeding.gif'],
  ['gif/playful/playing.gif', 'gif/playing.gif'],
  ['gif/newborn/peek.gif', 'gif/peek.gif'],
  ['gif/newborn/idle.gif', 'gif/newborn.gif'],
  ['gif/adult/curious.gif', 'gif/curious.gif'],
];

/** Source Lottie JSON for sharp vector playback on the marketing site. */
const lottieAssets = [
  ['adult/idle.json', 'lottie/idle.json'],
  ['adult/happy.json', 'lottie/happy.json'],
  ['adult/feeding.json', 'lottie/feeding.json'],
  ['playful/playing.json', 'lottie/playing.json'],
  ['newborn/peek.json', 'lottie/peek.json'],
  ['newborn/idle.json', 'lottie/newborn.json'],
  ['adult/curious.json', 'lottie/curious.json'],
];

const staticRoot = join(websiteRoot, 'static');
const staticAssets = [
  ['robots.txt', 'robots.txt'],
  ['sitemap.xml', 'sitemap.xml'],
];

mkdirSync(join(outPublic, 'gif'), { recursive: true });
mkdirSync(join(outPublic, 'lottie'), { recursive: true });

for (const [from, to] of gifAssets) {
  cpSync(join(repoPublic, from), join(outPublic, to));
}

for (const [from, to] of lottieAssets) {
  cpSync(join(lottieRoot, from), join(outPublic, to));
}

for (const [from, to] of staticAssets) {
  cpSync(join(staticRoot, from), join(outPublic, to));
}

console.log(
  `Copied ${gifAssets.length} raster assets and ${lottieAssets.length} Lottie clips to website/public/`,
);

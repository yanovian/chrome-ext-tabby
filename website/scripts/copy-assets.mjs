import { cpSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const websiteRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoPublic = join(websiteRoot, '..', 'public');
const outPublic = join(websiteRoot, 'public');

const assets = [
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

mkdirSync(join(outPublic, 'gif'), { recursive: true });

for (const [from, to] of assets) {
  cpSync(join(repoPublic, from), join(outPublic, to));
}

console.log(`Copied ${assets.length} assets from extension public/ to website/public/`);

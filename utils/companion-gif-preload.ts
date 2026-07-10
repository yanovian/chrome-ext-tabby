import {
  allCompanionAnimationPaths,
  peekDuckAnimationPath,
} from './companion-animation';
import type { CatLifeStage } from './types';
import { publicAnimationAssetUrl } from './runtime-client';

const PRELOAD_STAGES: CatLifeStage[] = ['newborn', 'playful', 'adult'];

/** Warm the extension GIF cache after install (service worker fetch). */
export async function warmCompanionGifCache(): Promise<void> {
  const paths = [
    ...allCompanionAnimationPaths(),
    ...PRELOAD_STAGES.map((stage) => peekDuckAnimationPath(stage)),
  ];

  await Promise.all(
    paths.map(async (path) => {
      try {
        await fetch(publicAnimationAssetUrl(path));
      } catch {
        // best-effort preload
      }
    }),
  );
}

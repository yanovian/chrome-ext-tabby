import { CompanionGifPlayer } from '../../utils/gif-companion';
import { companionPreviewSizeForStage, lifeStageFromCompanionAssetPath } from '../../utils/companion-animation';
import { publicAnimationAssetUrl } from '../../utils/runtime-client';
import type { CatLifeStage } from '../../utils/types';
import { previewHost } from './dom-refs';

let previewPlayer: CompanionGifPlayer | null = null;
let previewSpritePath: string | null = null;
let previewStage: CatLifeStage | null = null;

function applyPreviewSize(stage: CatLifeStage): void {
  const size = companionPreviewSizeForStage(stage);
  previewHost.style.width = `${size}px`;
  previewHost.style.height = `${size}px`;
}

export async function updatePreviewCat(
  assetPath: string,
  options: { force?: boolean; stage?: CatLifeStage } = {},
): Promise<void> {
  const stage = options.stage ?? lifeStageFromCompanionAssetPath(assetPath) ?? 'playful';
  if (!options.force && previewSpritePath === assetPath && previewStage === stage && previewPlayer) {
    return;
  }
  if (!previewPlayer) {
    previewPlayer = new CompanionGifPlayer();
    previewHost.appendChild(previewPlayer.image);
  }
  applyPreviewSize(stage);
  await previewPlayer.load(publicAnimationAssetUrl, assetPath);
  previewSpritePath = assetPath;
  previewStage = stage;
}

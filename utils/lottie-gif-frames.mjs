/** Frame timing and RGBA helpers for the Docker Lottie → GIF converter. */
import { writeFile } from 'node:fs/promises';

/** Use native Lottie fps when target is unset; otherwise use the target. */
export function resolveOutputFps(sourceFps, targetFps) {
  if (!Number.isFinite(targetFps) || targetFps <= 0) {
    return sourceFps;
  }
  return targetFps;
}

/** Frame count for a clip at the chosen output fps. */
export function outputFrameCount(durationSec, outputFps) {
  return Math.max(1, Math.round(durationSec * outputFps));
}

/** Clear only near-transparent fringe pixels; keep anti-aliased edges. */
export function stabilizeFrameAlpha(rgba, transparentCutoff = 8) {
  const out = new Uint8ClampedArray(rgba);
  for (let i = 3; i < out.length; i += 4) {
    if (out[i] < transparentCutoff) {
      out[i - 3] = 0;
      out[i - 2] = 0;
      out[i - 1] = 0;
      out[i] = 0;
    }
  }
  return out;
}

/** Downsample RGBA buffer with high-quality canvas smoothing. */
export function downsampleRgbaFrame(
  source,
  sourceWidth,
  sourceHeight,
  targetWidth,
  targetHeight,
  createCanvas,
) {
  const sourceCanvas = createCanvas(sourceWidth, sourceHeight);
  const sourceCtx = sourceCanvas.getContext('2d');
  const imageData = sourceCtx.createImageData(sourceWidth, sourceHeight);
  imageData.data.set(source);
  sourceCtx.putImageData(imageData, 0, 0);

  const targetCanvas = createCanvas(targetWidth, targetHeight);
  const targetCtx = targetCanvas.getContext('2d');
  targetCtx.imageSmoothingEnabled = true;
  targetCtx.imageSmoothingQuality = 'high';
  targetCtx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);
  return new Uint8ClampedArray(targetCtx.getImageData(0, 0, targetWidth, targetHeight).data);
}

/** Write stabilized RGBA pixels to a transparent PNG file. */
export async function writeRgbaPng(createCanvas, rgba, width, height, outputPath) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(width, height);
  imageData.data.set(rgba);
  ctx.putImageData(imageData, 0, 0);
  await writeFile(outputPath, canvas.toBuffer('image/png'));
}

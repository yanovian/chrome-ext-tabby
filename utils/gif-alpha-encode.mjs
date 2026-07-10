/** Shared GIF alpha/quality settings for the Docker converter. */

export const GIF_PIXEL_FORMAT = 'rgba4444';

/** Target output fps (upsamples past native Lottie ~30 when higher). */
export const TABBY_GIF_DEFAULT_FPS = 60;

/** Default render scale before downsample (2× = smoother edges). */
export const TABBY_GIF_RENDER_SCALE = 2;

/** Restore to background between frames (required for full-canvas transparent GIFs). */
export const GIF_DISPOSE_BACKGROUND = 2;

export const GIF_QUANTIZE_OPTIONS = {
  format: GIF_PIXEL_FORMAT,
  oneBitAlpha: false,
  clearAlpha: true,
  clearAlphaThreshold: 8,
  clearAlphaColor: 0x00,
  useSqrt: false,
};

/** Use native Lottie fps when target is unset; otherwise use the target (may upsample). */
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

export function gifFrameDelayMs(outputFps) {
  return Math.max(1, Math.round(1000 / outputFps));
}

/** Palette index for fully transparent swatch, if present. */
export function transparentPaletteIndex(palette) {
  const alphaIndex = palette.findIndex((color) => color.length >= 4 && color[3] === 0);
  if (alphaIndex >= 0) {
    return alphaIndex;
  }
  return palette.findIndex((color) => color[0] === 0 && color[1] === 0 && color[2] === 0);
}

/** Merge RGBA frame buffers for global palette quantization. */
export function mergeRgbaFrames(frames) {
  const totalBytes = frames.reduce((sum, frame) => sum + frame.length, 0);
  const merged = new Uint8ClampedArray(totalBytes);
  let offset = 0;
  for (const frame of frames) {
    merged.set(frame, offset);
    offset += frame.length;
  }
  return merged;
}

/** Clear only near-transparent fringe pixels; keep anti-aliased edges and soft shadows. */
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
export function downsampleRgbaFrame(source, sourceWidth, sourceHeight, targetWidth, targetHeight, createCanvas) {
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

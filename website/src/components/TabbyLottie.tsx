import { DotLottie } from '@lottiefiles/dotlottie-web';
import { useEffect, useRef, useState } from 'react';
import { assetUrl } from '@/lib/assets';

const SIZES = {
  feature: 200,
  hero: 176,
  showcase: 240,
} as const;

type TabbyLottieSize = keyof typeof SIZES;

const GIF_FALLBACK: Record<string, string> = {
  'lottie/idle.json': 'gif/idle.gif',
  'lottie/happy.json': 'gif/happy.gif',
  'lottie/feeding.json': 'gif/feeding.gif',
  'lottie/playing.json': 'gif/playing.gif',
  'lottie/peek.json': 'gif/peek.gif',
  'lottie/peek_duck.json': 'gif/peek_duck.gif',
  'lottie/newborn.json': 'gif/newborn.gif',
  'lottie/curious.json': 'gif/curious.gif',
};

type TabbyLottieProps = {
  /** One clip, or several to play back to back in one continuous loop (e.g. peek-in
   * then duck-out) instead of each clip snapping back to its own start on repeat. */
  src: string | readonly string[];
  className?: string;
  size?: TabbyLottieSize;
  alt?: string;
};

function setupCanvas(canvas: HTMLCanvasElement, dimension: number): number {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(dimension * dpr);
  canvas.height = Math.round(dimension * dpr);
  canvas.style.width = `${dimension}px`;
  canvas.style.height = `${dimension}px`;
  return dpr;
}

export function TabbyLottie({
  src,
  className = '',
  size = 'feature',
  alt = '',
}: TabbyLottieProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerRef = useRef<DotLottie | null>(null);
  const [useFallback, setUseFallback] = useState(false);
  const [motionOk, setMotionOk] = useState(true);
  const dimension = SIZES[size];
  const clips = Array.isArray(src) ? src : [src as string];
  const sequenceKey = clips.join('|');

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setMotionOk(!mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    let cancelled = false;
    setUseFallback(false);
    playerRef.current?.destroy();
    playerRef.current = null;

    Promise.all(
      clips.map((clip) =>
        fetch(assetUrl(clip)).then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to load ${clip}`);
          }
          return response.text();
        }),
      ),
    )
      .then((clipData) => {
        if (cancelled) {
          return;
        }

        setupCanvas(canvas, dimension);
        // A single clip keeps looping itself, exactly as before. Multiple clips play
        // once each in order, then the sequence as a whole repeats — that's what makes
        // "peek in, then duck out" read as one continuous loop instead of each clip
        // snapping back to its own frame 0.
        const sequenced = clipData.length > 1;
        const player = new DotLottie({
          canvas,
          data: clipData[0],
          autoplay: motionOk,
          loop: sequenced ? false : motionOk,
          useFrameInterpolation: true,
        });
        playerRef.current = player;

        if (sequenced && motionOk) {
          let nextIndex = 1 % clipData.length;
          const onComplete = () => {
            player.load({
              data: clipData[nextIndex],
              autoplay: true,
              loop: false,
              useFrameInterpolation: true,
            });
            nextIndex = (nextIndex + 1) % clipData.length;
          };
          player.addEventListener('complete', onComplete);
        }

        if (!motionOk) {
          const onLoad = () => {
            player.setFrame(0);
            player.pause();
            player.removeEventListener('load', onLoad);
          };
          player.addEventListener('load', onLoad);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUseFallback(true);
        }
      });

    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
    // `clips` isn't listed below: it's derived fresh from `src` every render, always in
    // sync with `sequenceKey`, which is.
  }, [sequenceKey, dimension, motionOk]);

  const fallbackSrc = GIF_FALLBACK[clips[0]];

  return (
    <div
      className={`tabby-lottie tabby-lottie--${size} ${className}`.trim()}
      style={{ width: dimension, height: dimension }}
    >
      {useFallback && fallbackSrc ? (
        <img
          className="tabby-lottie__fallback"
          src={assetUrl(fallbackSrc)}
          alt={alt}
          width={dimension}
          height={dimension}
          loading="lazy"
        />
      ) : (
        <canvas ref={canvasRef} className="tabby-lottie__canvas" aria-hidden={alt === ''} />
      )}
    </div>
  );
}

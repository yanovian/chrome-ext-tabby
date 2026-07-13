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
  'lottie/newborn.json': 'gif/newborn.gif',
  'lottie/curious.json': 'gif/curious.gif',
};

type TabbyLottieProps = {
  src: string;
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

    fetch(assetUrl(src))
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load ${src}`);
        }
        return response.text();
      })
      .then((data) => {
        if (cancelled) {
          return;
        }

        setupCanvas(canvas, dimension);
        const player = new DotLottie({
          canvas,
          data,
          autoplay: motionOk,
          loop: motionOk,
          useFrameInterpolation: true,
        });
        playerRef.current = player;

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
  }, [src, dimension, motionOk]);

  const fallbackSrc = GIF_FALLBACK[src];

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

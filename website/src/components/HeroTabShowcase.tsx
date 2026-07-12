import { useEffect, useState } from 'react';
import { TabbyLottie } from '@/components/TabbyLottie';
import { HERO_SCENE_MS, HERO_TRANSITION_MS, heroScenes } from '@/content';

function sceneAt(offset: number, from: number) {
  const len = heroScenes.length;
  return heroScenes[(from + offset + len) % len]!;
}

export function HeroTabShowcase() {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<'show' | 'leave'>('show');
  const [motionOk, setMotionOk] = useState(true);

  const scene = heroScenes[index]!;
  const backTab = sceneAt(1, index);
  const farTab = sceneAt(2, index);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setMotionOk(!mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!motionOk) {
      return;
    }

    let swapTimer: ReturnType<typeof setTimeout> | undefined;
    const loopTimer = setInterval(() => {
      setPhase('leave');
      swapTimer = setTimeout(() => {
        setIndex((current) => (current + 1) % heroScenes.length);
        setPhase('show');
      }, HERO_TRANSITION_MS);
    }, HERO_SCENE_MS);

    return () => {
      clearInterval(loopTimer);
      if (swapTimer) {
        clearTimeout(swapTimer);
      }
    };
  }, [motionOk]);

  return (
    <div className="tab-showcase" aria-hidden="true">
      <div className="tab-showcase__glow" />

      <div className="tab-showcase__stack">
        <div className="tab-showcase__sheet tab-showcase__sheet--far">
          <div className="tab-showcase__tabbar">
            <span className="tab-showcase__tab">{farTab.tab}</span>
          </div>
          <div className="tab-showcase__page tab-showcase__page--ghost" />
        </div>

        <div className="tab-showcase__sheet tab-showcase__sheet--near">
          <div className="tab-showcase__tabbar">
            <span className="tab-showcase__tab">{backTab.tab}</span>
          </div>
          <div className="tab-showcase__page tab-showcase__page--ghost" />
        </div>

        <div
          className={`tab-showcase__sheet tab-showcase__sheet--active tab-showcase__sheet--${phase}`}
        >
          <div className="tab-showcase__tabbar">
            {heroScenes.map((item) => (
              <span
                key={item.id}
                className={`tab-showcase__tab ${
                  item.id === scene.id ? 'tab-showcase__tab--active' : ''
                }`}
              >
                {item.tab}
              </span>
            ))}
          </div>

          <div className="tab-showcase__page" key={scene.id}>
            <p className="tab-showcase__speech" aria-live="polite">
              {scene.speech}
            </p>
            <div className="tab-showcase__cat-wrap">
              <TabbyLottie
                key={scene.id}
                src={scene.lottie}
                size="hero"
                alt={scene.alt}
                className="tab-showcase__cat"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

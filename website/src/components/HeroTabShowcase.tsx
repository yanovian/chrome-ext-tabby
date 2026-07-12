import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TabbyLottie } from '@/components/TabbyLottie';
import { HERO_SCENE_MS, HERO_TRANSITION_MS, heroSceneDefs } from '@/content';

type HeroScene = {
  id: string;
  tab: string;
  lottie: string;
  speech: string;
  alt: string;
};

function sceneAt(scenes: HeroScene[], offset: number, from: number) {
  const len = scenes.length;
  return scenes[(from + offset + len) % len]!;
}

export function HeroTabShowcase() {
  const { t, i18n } = useTranslation('marketing');
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<'show' | 'leave'>('show');
  const [motionOk, setMotionOk] = useState(true);

  const heroScenes = useMemo(
    () =>
      heroSceneDefs.map((def) => ({
        id: def.id,
        lottie: def.lottie,
        tab: t(`scene${def.key}Tab`),
        speech: t(`scene${def.key}Speech`),
        alt: t(`scene${def.key}Alt`),
      })),
    [t, i18n.language],
  );

  const scene = heroScenes[index]!;
  const backTab = sceneAt(heroScenes, 1, index);
  const farTab = sceneAt(heroScenes, 2, index);

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
  }, [motionOk, heroScenes.length]);

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

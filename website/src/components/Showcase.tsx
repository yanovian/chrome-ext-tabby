import { useTranslation } from 'react-i18next';
import { Section } from '@/components/ui';
import { TabbyLottie } from '@/components/TabbyLottie';
import { moodDefs } from '@/content';

export function Showcase() {
  const { t } = useTranslation('marketing');

  return (
    <Section id="vibe">
      <div className="showcase">
        <div className="showcase__copy">
          <p className="eyebrow">{t('showcaseEyebrow')}</p>
          <h2>{t('showcaseTitle')}</h2>
          <p>{t('showcaseBody')}</p>
          <ul className="mood-pills" aria-label="Example moods">
            {moodDefs.map((mood) => (
              <li key={mood.key} className={`mood-pill mood-pill--${mood.tone}`}>
                {t(`mood${mood.key}`)}
              </li>
            ))}
          </ul>
        </div>
        <div className="showcase__frame">
          <TabbyLottie
            src="lottie/curious.json"
            size="showcase"
            className="showcase__lottie"
            alt={t('sceneCuriousAlt')}
          />
          <div className="showcase__caption">{t('showcaseCaption')}</div>
        </div>
      </div>
    </Section>
  );
}

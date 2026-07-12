import { Section, SectionHeading } from '@/components/ui';
import { TabbyLottie } from '@/components/TabbyLottie';
import { features } from '@/content';

export function Features() {
  return (
    <Section id="features" tinted>
      <SectionHeading
        title="Company in the tabs you already have"
        lead="Moods, care moments, and a cat who remembers places you visit together."
      />
      <ul className="feature-grid">
        {features.map((feature) => (
          <li key={feature.title} className="feature-card">
            <div className="feature-card__media">
              <TabbyLottie src={feature.lottie} />
            </div>
            <div className="feature-card__body">
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

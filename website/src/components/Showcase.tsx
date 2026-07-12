import { Section } from '@/components/ui';
import { TabbyLottie } from '@/components/TabbyLottie';

const moods = [
  { label: 'Hungry', tone: 'warm' },
  { label: 'Happy', tone: 'gold' },
  { label: 'Stressed', tone: 'rose' },
  { label: 'Sleepy', tone: 'violet' },
  { label: 'Curious', tone: 'mint' },
];

export function Showcase() {
  return (
    <Section id="vibe">
      <div className="showcase">
        <div className="showcase__copy">
          <p className="eyebrow">Shiny, silly, sincere</p>
          <h2>She feels the vibe of your browsing</h2>
          <p>
            Tabby shifts mood from the title and web address of your active tab, nothing more.
            Busy evening? Snooze her. Quiet page? She might peek in with a hungry grumble or a
            goofy line.
          </p>
          <ul className="mood-pills" aria-label="Example moods">
            {moods.map((mood) => (
              <li key={mood.label} className={`mood-pill mood-pill--${mood.tone}`}>
                {mood.label}
              </li>
            ))}
          </ul>
        </div>
        <div className="showcase__frame">
          <TabbyLottie src="lottie/curious.json" size="showcase" className="showcase__lottie" alt="Tabby looking curious" />
          <div className="showcase__caption">Tap her anytime for the care menu</div>
        </div>
      </div>
    </Section>
  );
}

import { Button, Section } from '@/components/ui';
import { CHROME_STORE_URL, privacyPoints } from '@/content';

export function PrivacyStrip() {
  return (
    <Section id="privacy" tinted>
      <div className="privacy-strip">
        <div>
          <p className="eyebrow">Private by design</p>
          <h2>Your browsing stays yours</h2>
          <ul className="privacy-list">
            {privacyPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <Button to="/privacy" variant="ghost">
            Read the privacy policy
          </Button>
        </div>
        <div className="privacy-strip__cta">
          <p>Ready for a co-pilot with whiskers?</p>
          <Button href={CHROME_STORE_URL}>Get Tabby free</Button>
        </div>
      </div>
    </Section>
  );
}

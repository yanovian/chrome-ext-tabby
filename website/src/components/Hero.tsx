import { Button } from '@/components/ui';
import { HeroTabShowcase } from '@/components/HeroTabShowcase';
import { CHROME_STORE_URL } from '@/content';

export function Hero() {
  return (
    <section className="hero">
      <div className="hero__glow" aria-hidden="true" />
      <div className="container hero__grid">
        <div className="hero__copy">
          <img className="hero__logo" src="icon.png" width={72} height={72} alt="" />
          <p className="eyebrow">Meet Tabby, a Chrome extension</p>
          <h1>
            A cat that lives in
            <span className="hero__accent"> your browser</span>
          </h1>
          <p className="hero__lead">
            Tabby keeps you company while you browse. Pet her, feed her, and watch her grow
            from kitten to adult. She reacts gently to your active tab and never sends your
            data anywhere.
          </p>
          <div className="hero__actions">
            <Button href={CHROME_STORE_URL}>Install free on Chrome</Button>
            <Button href="#features" variant="ghost" external={false}>
              See what she does
            </Button>
          </div>
        </div>

        <HeroTabShowcase />
      </div>
    </section>
  );
}

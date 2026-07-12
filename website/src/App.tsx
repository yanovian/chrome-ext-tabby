import { Features } from '@/components/Features';
import { Footer } from '@/components/Footer';
import { Hero } from '@/components/Hero';
import { PrivacyStrip } from '@/components/PrivacyStrip';
import { Seo } from '@/components/Seo';
import { Showcase } from '@/components/Showcase';

export function App() {
  return (
    <>
      <Seo />
      <Hero />
      <main>
        <Features />
        <Showcase />
        <PrivacyStrip />
      </main>
      <Footer />
    </>
  );
}

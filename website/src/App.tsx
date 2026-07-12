import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { LocaleRoute } from '@/components/LocaleRoute';
import { LocaleSync } from '@/components/LocaleSync';
import { SiteHead } from '@/components/SiteHead';
import { ScrollToTop } from '@/components/ScrollToTop';
import { HomePage } from '@/pages/HomePage';
import { PrivacyPage } from '@/pages/PrivacyPage';
import { TermsPage } from '@/pages/TermsPage';

const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined;

export function App() {
  return (
    <BrowserRouter basename={routerBasename}>
      <LocaleSync />
      <SiteHead />
      <div className="site-chrome">
        <LanguageSwitcher />
      </div>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/:locale" element={<LocaleRoute page="home" />} />
        <Route path="/:locale/privacy" element={<LocaleRoute page="privacy" />} />
        <Route path="/:locale/terms" element={<LocaleRoute page="terms" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { LocaleDirection } from '@/components/LocaleDirection';
import { ScrollToTop } from '@/components/ScrollToTop';
import { HomePage } from '@/pages/HomePage';
import { PrivacyPage } from '@/pages/PrivacyPage';
import { TermsPage } from '@/pages/TermsPage';

const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined;

export function App() {
  return (
    <BrowserRouter basename={routerBasename}>
      <LocaleDirection />
      <div className="site-chrome">
        <LanguageSwitcher />
      </div>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

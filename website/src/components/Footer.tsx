import { Link } from 'react-router-dom';
import {
  POUYAN_RAZIAN_URL,
  YANOVIAN_LLC_URL,
} from '../../site-meta';
import { GITHUB_URL } from '@/content';
import { Trans, useTranslation } from 'react-i18next';

export function Footer() {
  const { t } = useTranslation('common');
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div className="footer__brand">
          <img src="icon-48.png" width={32} height={32} alt="" />
          <span>Tabby</span>
        </div>
        <p className="footer__tagline">{t('footerTagline')}</p>
        <p className="footer__credit">
          <Trans
            i18nKey="footerCredit"
            t={t}
            components={{
              yanovian: (
                <a href={YANOVIAN_LLC_URL} target="_blank" rel="noopener noreferrer">
                  Yanovian LLC
                </a>
              ),
              pooyan: (
                <a href={POUYAN_RAZIAN_URL} target="_blank" rel="noopener noreferrer">
                  Pooyan Razian
                </a>
              ),
            }}
          />
        </p>
        <nav className="footer__links" aria-label="Footer">
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
            {t('sourceOnGitHub')}
          </a>
          <Link to="/privacy">{t('privacyLink')}</Link>
          <Link to="/terms">{t('termsLink')}</Link>
        </nav>
        <p className="footer__copy">© {year} Tabby</p>
      </div>
    </footer>
  );
}

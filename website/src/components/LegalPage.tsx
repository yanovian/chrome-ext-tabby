import { Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { Footer } from '@/components/Footer';
import { PageSeo } from '@/components/PageSeo';
import { Container } from '@/components/ui';
import { prepareLegalMarkdown, renderMarkdown } from '@/lib/markdown';

type LegalPageProps = {
  pageKey: 'privacy' | 'terms';
  path: string;
  repoUrl: string;
  markdown: string;
};

export function LegalPage({ pageKey, path, repoUrl, markdown }: LegalPageProps) {
  const { t } = useTranslation('legal');
  const html = renderMarkdown(prepareLegalMarkdown(markdown));

  return (
    <>
      <PageSeo pageKey={pageKey} path={path} />
      <header className="legal-header">
        <Container className="legal-header__inner">
          <Link className="legal-header__brand" to="/">
            <img src="icon-48.png" width={28} height={28} alt="" />
            <span>Tabby</span>
          </Link>
          <nav className="legal-header__nav" aria-label="Legal">
            <Link to="/privacy">{t('privacyNav')}</Link>
            <Link to="/terms">{t('termsNav')}</Link>
          </nav>
        </Container>
      </header>
      <main className="legal-page">
        <Container>
          <div className="legal-notice" role="note">
            <p>
              <Trans
                i18nKey="authoritativeNotice"
                t={t}
                components={{
                  repo: (
                    <a href={repoUrl} target="_blank" rel="noopener noreferrer">
                      {t('repoLinkText')}
                    </a>
                  ),
                }}
              />
            </p>
          </div>
          <article
            className="legal-doc"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </Container>
      </main>
      <Footer />
    </>
  );
}

import termsMarkdown from '../../../TERMS.md?raw';
import { LegalPage } from '@/components/LegalPage';
import { TERMS_PATH, TERMS_REPO_URL } from '@/content';

export function TermsPage() {
  return (
    <LegalPage
      pageKey="terms"
      path={TERMS_PATH}
      repoUrl={TERMS_REPO_URL}
      markdown={termsMarkdown}
    />
  );
}

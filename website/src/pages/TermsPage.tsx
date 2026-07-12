import termsMarkdown from '../../../TERMS.md?raw';
import { LegalPage } from '@/components/LegalPage';
import { TERMS_REPO_URL } from '@/content';

export function TermsPage() {
  return (
    <LegalPage
      repoUrl={TERMS_REPO_URL}
      markdown={termsMarkdown}
    />
  );
}

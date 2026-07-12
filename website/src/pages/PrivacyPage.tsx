import privacyMarkdown from '../../../PRIVACY.md?raw';
import { LegalPage } from '@/components/LegalPage';
import { PRIVACY_PATH, PRIVACY_REPO_URL } from '@/content';

export function PrivacyPage() {
  return (
    <LegalPage
      pageKey="privacy"
      path={PRIVACY_PATH}
      repoUrl={PRIVACY_REPO_URL}
      markdown={privacyMarkdown}
    />
  );
}

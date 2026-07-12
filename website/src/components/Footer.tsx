import { GITHUB_URL } from '@/content';

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div className="footer__brand">
          <img src="icon-48.png" width={32} height={32} alt="" />
          <span>Tabby</span>
        </div>
        <p className="footer__tagline">A cat lives in your browser.</p>
        <nav className="footer__links" aria-label="Footer">
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
            Source on GitHub
          </a>
          <a href={`${GITHUB_URL}/blob/master/PRIVACY.md`} target="_blank" rel="noopener noreferrer">
            Privacy
          </a>
        </nav>
        <p className="footer__copy">© {year} Tabby</p>
      </div>
    </footer>
  );
}

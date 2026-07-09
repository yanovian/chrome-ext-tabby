/** Host roots where Tabby does not inject her overlay (sensitive sites and strict CSP). */
export const OVERLAY_EXCLUDED_HOST_ROOTS: readonly string[] = [
  // Dev platforms with strict CSP (WASM blocked in page context).
  'github.com',
  'gitlab.com',
  // Email and account sign-in.
  'gmail.com',
  'mail.google.com',
  'accounts.google.com',
  'outlook.com',
  'outlook.live.com',
  'outlook.office.com',
  'hotmail.com',
  'mail.yahoo.com',
  'proton.me',
  'protonmail.com',
  'icloud.com',
  'fastmail.com',
  'zoho.com',
  // Payments and wallets.
  'paypal.com',
  'stripe.com',
  'venmo.com',
  'cash.app',
  'squareup.com',
  'wise.com',
  'revolut.com',
  'coinbase.com',
  'robinhood.com',
  // Password managers.
  '1password.com',
  'lastpass.com',
  'bitwarden.com',
  'dashlane.com',
  'keepersecurity.com',
  // Major banks (US and international).
  'chase.com',
  'jpmorganchase.com',
  'bankofamerica.com',
  'wellsfargo.com',
  'citi.com',
  'citibank.com',
  'capitalone.com',
  'usbank.com',
  'pnc.com',
  'td.com',
  'tdbank.com',
  'americanexpress.com',
  'amex.com',
  'discover.com',
  'ally.com',
  'schwab.com',
  'fidelity.com',
  'vanguard.com',
  'morganstanley.com',
  'goldmansachs.com',
  'barclays.com',
  'hsbc.com',
  'lloydsbank.com',
  'natwest.com',
  'rbs.co.uk',
  'santander.co.uk',
  'santander.com',
  'deutsche-bank.de',
  'bnpparibas.com',
  'ing.com',
  'navyfederal.org',
  'becu.org',
  'chime.com',
  'sofi.com',
  // Tax and benefits portals.
  'irs.gov',
  'ssa.gov',
  'medicare.gov',
  'healthcare.gov',
];

const BANKING_HOST_FALSE_POSITIVES = [
  'foodbank',
  'sandbank',
  'memorybank',
  'piggybank',
  'bankrate',
  'bankless',
  'embankment',
  'riverbank',
] as const;

const BANKING_HOST_TOKENS = ['bank', 'creditunion', 'cu.coop'] as const;

const CHROME_STORE_EXCLUDE_MATCHES = [
  '*://chrome.google.com/webstore/*',
  '*://chromewebstore.google.com/*',
] as const;

function normalizeHostname(hostname: string): string {
  return hostname.replace(/^www\./, '').toLowerCase();
}

function hostMatchesRoot(hostname: string, root: string): boolean {
  return hostname === root || hostname.endsWith(`.${root}`);
}

export function looksLikeBankingHost(hostname: string): boolean {
  const host = normalizeHostname(hostname);
  if (host.endsWith('.bank')) {
    return true;
  }
  if (!BANKING_HOST_TOKENS.some((token) => host.includes(token))) {
    return false;
  }
  return !BANKING_HOST_FALSE_POSITIVES.some((fragment) => host.includes(fragment));
}

export function isOverlayHostExcluded(hostname: string | undefined): boolean {
  if (!hostname) {
    return true;
  }
  const host = normalizeHostname(hostname);
  if (OVERLAY_EXCLUDED_HOST_ROOTS.some((root) => hostMatchesRoot(host, root))) {
    return true;
  }
  return looksLikeBankingHost(host);
}

/** Manifest `exclude_matches` for known excluded host roots plus the Chrome Web Store. */
export function overlayExcludeMatchPatterns(): string[] {
  const patterns: string[] = [...CHROME_STORE_EXCLUDE_MATCHES];
  for (const root of OVERLAY_EXCLUDED_HOST_ROOTS) {
    patterns.push(`*://${root}/*`);
    patterns.push(`*://*.${root}/*`);
  }
  return patterns;
}

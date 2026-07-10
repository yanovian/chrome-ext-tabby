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

function normalizeHostname(hostname: string): string {
  return hostname.replace(/^www\./, '').toLowerCase();
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

export function hostMatchesRoot(hostname: string, root: string): boolean {
  const host = normalizeHostname(hostname);
  const normalizedRoot = root.toLowerCase();
  return host === normalizedRoot || host.endsWith(`.${normalizedRoot}`);
}

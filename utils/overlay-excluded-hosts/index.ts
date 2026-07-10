import { ARMENIA_BANK_HOST_ROOTS } from './banks-armenia';
import { ASIA_PACIFIC_BANK_HOST_ROOTS } from './banks-asia-pacific';
import { CANADA_BANK_HOST_ROOTS } from './banks-canada';
import { CAUCASUS_BANK_HOST_ROOTS } from './banks-caucasus';
import { CENTRAL_ASIA_BANK_HOST_ROOTS } from './banks-central-asia';
import { EUROPE_BANK_HOST_ROOTS } from './banks-europe';
import { IRAN_BANK_HOST_ROOTS } from './banks-iran';
import { LATAM_BANK_HOST_ROOTS } from './banks-latam';
import { MIDDLE_EAST_AFRICA_BANK_HOST_ROOTS } from './banks-middle-east-africa';
import { RUSSIA_BANK_HOST_ROOTS } from './banks-russia';
import { TURKEY_BANK_HOST_ROOTS } from './banks-turkey';
import { UK_IE_BANK_HOST_ROOTS } from './banks-uk-ie';
import { US_BANK_HOST_ROOTS } from './banks-us';
import { hostMatchesRoot, looksLikeBankingHost } from './heuristics';
import { PASSWORD_MANAGER_HOST_ROOTS } from './password-managers';
import { PAYMENT_HOST_ROOTS } from './payments';

/** Host roots where Tabby does not inject her overlay. */
export const OVERLAY_EXCLUDED_HOST_ROOTS: readonly string[] = [
  ...new Set([
    ...PAYMENT_HOST_ROOTS,
    ...PASSWORD_MANAGER_HOST_ROOTS,
    ...US_BANK_HOST_ROOTS,
    ...CANADA_BANK_HOST_ROOTS,
    ...UK_IE_BANK_HOST_ROOTS,
    ...EUROPE_BANK_HOST_ROOTS,
    ...ARMENIA_BANK_HOST_ROOTS,
    ...RUSSIA_BANK_HOST_ROOTS,
    ...TURKEY_BANK_HOST_ROOTS,
    ...CAUCASUS_BANK_HOST_ROOTS,
    ...CENTRAL_ASIA_BANK_HOST_ROOTS,
    ...IRAN_BANK_HOST_ROOTS,
    ...ASIA_PACIFIC_BANK_HOST_ROOTS,
    ...LATAM_BANK_HOST_ROOTS,
    ...MIDDLE_EAST_AFRICA_BANK_HOST_ROOTS,
  ]),
];

export { looksLikeBankingHost } from './heuristics';

export function isOverlayHostExcluded(hostname: string | undefined): boolean {
  if (!hostname) {
    return true;
  }
  const host = hostname.replace(/^www\./, '').toLowerCase();
  if (OVERLAY_EXCLUDED_HOST_ROOTS.some((root) => hostMatchesRoot(host, root))) {
    return true;
  }
  return looksLikeBankingHost(host);
}

/** Manifest `exclude_matches` for known sensitive host roots. */
export function overlayExcludeMatchPatterns(): string[] {
  const patterns: string[] = [];
  for (const root of OVERLAY_EXCLUDED_HOST_ROOTS) {
    patterns.push(`*://${root}/*`);
    patterns.push(`*://*.${root}/*`);
  }
  return patterns;
}

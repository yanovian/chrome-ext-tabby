/** Strip `www.` and lowercase, so registry hosts never need to list both forms. */
export function normalizeHostname(hostname: string): string {
  return hostname.replace(/^www\./, '').toLowerCase();
}

/** Hostname from a page URL, or `''` for an unparsable one. */
export function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** True when `normalizedHost` is exactly `registeredHost` or one of its subdomains. */
export function hostMatches(normalizedHost: string, registeredHost: string): boolean {
  return normalizedHost === registeredHost || normalizedHost.endsWith(`.${registeredHost}`);
}

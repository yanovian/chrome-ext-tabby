/** Minimum time on a page before it can affect Tabby's mood (production). */
export const MIN_PAGE_DWELL_MS = 60_000;

/** How many recent page visits we remember to prevent farming mood by tab-switching. */
export const RECENT_VISIT_LIMIT = 10;

export function hasDwelledLongEnough(
  focusStartedAt: number | null,
  now: number,
  minDwellMs: number,
): boolean {
  if (focusStartedAt === null || minDwellMs <= 0) {
    return false;
  }
  return now - focusStartedAt >= minDwellMs;
}

/**
 * Stable page identity for dedup — hostname + pathname, no query or hash.
 * Same page with different tracking params still counts once.
 */
export function pageVisitKey(url: string): string | null {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    const path = parsed.pathname.replace(/\/+$/, '') || '/';
    return `${host}${path}`;
  } catch {
    return null;
  }
}

/** Pure dedup check — returns whether this visit should count and the updated ring buffer. */
export function registerVisit(
  url: string,
  recentKeys: readonly string[],
  limit = RECENT_VISIT_LIMIT,
): { counted: boolean; recentKeys: string[] } {
  const key = pageVisitKey(url);
  if (!key) {
    return { counted: false, recentKeys: [...recentKeys] };
  }

  if (recentKeys.includes(key)) {
    return { counted: false, recentKeys: [...recentKeys] };
  }

  return {
    counted: true,
    recentKeys: [key, ...recentKeys].slice(0, limit),
  };
}

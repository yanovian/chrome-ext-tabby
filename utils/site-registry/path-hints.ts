/**
 * High-confidence URL path fragments for news detection on unknown hosts.
 * Avoid language codes (/persian, /farsi, /noticias) and feed labels (/for-you, /popular):
 * they appear on non-news pages too.
 */
export const HIGH_CONFIDENCE_NEWS_PATH_HINTS = [
  '/news',
  '/headlines',
  '/breaking',
] as const;

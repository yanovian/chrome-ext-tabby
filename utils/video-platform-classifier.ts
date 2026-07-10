import type { BrowseCategory } from './types';
import { classifyFromTitleHints } from './title-keywords';

/** User-uploaded and short-form video sites — mood depends on title and path. */
const VIDEO_PLATFORM_HOSTS = [
  'youtube.com',
  'youtu.be',
  'm.youtube.com',
  'rutube.ru',
  'vimeo.com',
  'dailymotion.com',
  'bilibili.com',
  'nicovideo.jp',
  'twitch.tv',
  'odysee.com',
  'bitchute.com',
] as const;

const SHORT_FORM_PATH_HINTS = ['/shorts', '/clips', '/short/'] as const;

export function isVideoPlatformHost(hostname: string): boolean {
  const normalized = hostname.replace(/^www\./, '').toLowerCase();
  return VIDEO_PLATFORM_HOSTS.some(
    (host) => normalized === host || normalized.endsWith(`.${host}`),
  );
}

/** Guess mood for YouTube-style platforms from path and tab title only. */
export function classifyVideoPlatform(
  title: string,
  path: string,
): { category: BrowseCategory; confidence: number } {
  const normalizedPath = path.toLowerCase();

  if (SHORT_FORM_PATH_HINTS.some((hint) => normalizedPath.includes(hint))) {
    return { category: 'draining', confidence: 0.8 };
  }

  const fromTitle = classifyFromTitleHints(title, { minDrainingHits: 1 });
  if (fromTitle) {
    return fromTitle;
  }

  if (
    normalizedPath.includes('/watch') ||
    normalizedPath.includes('/live') ||
    normalizedPath.includes('/video')
  ) {
    return { category: 'neutral', confidence: 0.5 };
  }

  return { category: 'neutral', confidence: 0.45 };
}

import type { BrowseCategory } from './types';
import { classifyVideoPlatform } from './video-platform-classifier';

export function isYouTubeHost(hostname: string): boolean {
  const normalized = hostname.replace(/^www\./, '').toLowerCase();
  return (
    normalized === 'youtube.com' ||
    normalized === 'youtu.be' ||
    normalized === 'm.youtube.com' ||
    normalized.endsWith('.youtube.com')
  );
}

/** Guess YouTube video mood from URL path and tab title only — no page body. */
export function classifyYouTube(
  title: string,
  path: string,
): { category: BrowseCategory; confidence: number } {
  return classifyVideoPlatform(title, path);
}

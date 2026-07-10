import type { DrainingSessionKind } from '../types';
import type { SiteRule } from './types';
import { HIGH_CONFIDENCE_NEWS_PATH_HINTS } from './path-hints';
import { NEWS_TITLE_HINTS } from './title-hints';
import { SITE_RULES } from './rules';

function parseHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function parsePath(url: string): string {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return '';
  }
}

export function matchSiteRule(hostname: string, path: string): SiteRule | null {
  const normalizedHost = hostname.replace(/^www\./, '').toLowerCase();
  const normalizedPath = path.toLowerCase();

  for (const rule of SITE_RULES) {
    const hostMatch = rule.hosts.some(
      (host) => normalizedHost === host || normalizedHost.endsWith(`.${host}`),
    );
    if (!hostMatch) {
      continue;
    }

    if (rule.drainingPaths?.some((hint) => normalizedPath.includes(hint))) {
      return { ...rule, category: 'draining' };
    }
    if (rule.nourishingPaths?.some((hint) => normalizedPath.includes(hint))) {
      return { ...rule, category: 'nourishing' };
    }

    return rule;
  }

  return null;
}

/** Classify the active tab for long-session overwhelmed tracking. */
export function matchDrainingSessionKind(
  title: string | undefined,
  url: string | undefined,
): DrainingSessionKind | null {
  if (!url) {
    return null;
  }

  const hostname = parseHostname(url);
  const path = parsePath(url);
  const siteRule = matchSiteRule(hostname, path);

  if (siteRule?.drainingKind) {
    return siteRule.drainingKind;
  }

  if (siteRule?.category === 'draining' && siteRule.topic === 'Social') {
    return 'social';
  }

  if (siteRule?.category === 'draining') {
    return 'news';
  }

  const combined = `${title ?? ''} ${path}`.toLowerCase();
  if (HIGH_CONFIDENCE_NEWS_PATH_HINTS.some((hint) => path.includes(hint))) {
    return 'news';
  }
  if (NEWS_TITLE_HINTS.some((hint) => combined.includes(hint))) {
    return 'news';
  }

  return null;
}

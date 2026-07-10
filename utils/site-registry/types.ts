import type { BrowseCategory } from '../types';

export interface SiteRule {
  hosts: readonly string[];
  category: BrowseCategory;
  /** Long-session overwhelmed tracking when set. */
  drainingKind?: 'social' | 'news';
  /**
   * Path fragments that reinforce draining on this host only.
   * Use sparingly: language segments (/fa, /persian) and feed labels (/for-you) are ambiguous.
   */
  drainingPaths?: readonly string[];
  nourishingPaths?: readonly string[];
  topic?: string;
}

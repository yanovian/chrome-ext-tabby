import type { SiteRule } from './types';
import { SOCIAL_SITE_RULES } from './social';
import { GOSSIP_NEWS_RULES, INTERNATIONAL_BROADCASTER_RULES, WESTERN_NEWS_RULES } from './news-gossip';
import { EUROPE_NEWS_RULES } from './news-europe';
import { ASIA_NEWS_RULES } from './news-asia';
import { AMERICAS_NEWS_RULES } from './news-americas';
import { MIDDLE_EAST_NEWS_RULES } from './news-middle-east';
import { AFRICA_NEWS_RULES } from './news-africa';
import { OCEANIA_NEWS_RULES } from './news-oceania';
import { ARMENIA_NEWS_RULES } from './news-armenia';
import { IRAN_NEWS_RULES } from './news-iran';
import { NORDIC_NEWS_RULES } from './news-nordic';
import { NOURISHING_SITE_RULES } from './nourishing';
import { NEUTRAL_SITE_RULES } from './neutral';

/** Known sites, checked before generic title/URL keywords. Order: social, news by region, nourishing, neutral. */
export const SITE_RULES: readonly SiteRule[] = [
  ...SOCIAL_SITE_RULES,
  ...GOSSIP_NEWS_RULES,
  ...WESTERN_NEWS_RULES,
  ...INTERNATIONAL_BROADCASTER_RULES,
  ...EUROPE_NEWS_RULES,
  ...ASIA_NEWS_RULES,
  ...AMERICAS_NEWS_RULES,
  ...MIDDLE_EAST_NEWS_RULES,
  ...AFRICA_NEWS_RULES,
  ...OCEANIA_NEWS_RULES,
  ...ARMENIA_NEWS_RULES,
  ...IRAN_NEWS_RULES,
  ...NORDIC_NEWS_RULES,
  ...NOURISHING_SITE_RULES,
  ...NEUTRAL_SITE_RULES,
];

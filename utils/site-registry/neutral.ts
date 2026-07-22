import type { SiteRule } from './types';

export const NEUTRAL_SITE_RULES: readonly SiteRule[] = [
  {
    // Blogging platforms host everything from tutorials to outrage bait — the host
    // alone doesn't say which, so start neutral and let title keywords decide
    // (see utils/title-keywords.ts).
    hosts: [
      'medium.com',
      'dev.to',
      'hashnode.com',
      'substack.com',
      'wordpress.com',
      'blogger.com',
      'blogspot.com',
      'livejournal.com',
      'dreamwidth.org',
      'wattpad.com',
    ],
    category: 'neutral',
    topic: 'Writing',
  },
  {
    // Generic wiki-hosting platforms cover any topic, good or bad — unlike
    // wikipedia.org (a specific, curated encyclopedia kept nourishing), so title
    // keywords decide here too.
    hosts: ['fandom.com', 'wikia.org', 'miraheze.org', 'wikidot.com', 'tvtropes.org'],
    category: 'neutral',
    topic: 'Wiki',
  },
  {
    // Hospitality exchange / travel coordination, not a doomscroll feed.
    hosts: [
      'warmshowers.org',
      'couchsurfing.com',
      'couchsurfing.org',
      'airbnb.com',
      'travellerspoint.com',
      'wayn.com',
    ],
    category: 'neutral',
    topic: 'Travel',
  },
  {
    hosts: [
      'chase.com',
      'bankofamerica.com',
      'wellsfargo.com',
      'paypal.com',
      'stripe.com',
      'mail.google.com',
      'outlook.live.com',
      'outlook.office.com',
    ],
    category: 'neutral',
    topic: 'Errands',
  },
  {
    hosts: ['amazon.com', 'amazon.co.uk', 'ebay.com', 'etsy.com', 'shopify.com'],
    category: 'neutral',
    topic: 'Shopping',
  },
];

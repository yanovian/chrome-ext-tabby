import type { SiteRule } from './types';

export const NEUTRAL_SITE_RULES: readonly SiteRule[] = [
  {
    hosts: ['medium.com', 'dev.to', 'hashnode.com', 'substack.com'],
    category: 'neutral',
    topic: 'Writing',
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

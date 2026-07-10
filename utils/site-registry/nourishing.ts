import type { SiteRule } from './types';

export const NOURISHING_SITE_RULES: readonly SiteRule[] = [
  {
    hosts: [
      'github.com',
      'gitlab.com',
      'stackoverflow.com',
      'stackexchange.com',
      'developer.mozilla.org',
      'kubernetes.io',
      'docs.python.org',
      'readthedocs.io',
      'npmjs.com',
      'pypi.org',
      'crates.io',
    ],
    category: 'nourishing',
    nourishingPaths: ['/docs', '/documentation', '/learn', '/tutorial', '/guide', '/book'],
    topic: 'Development',
  },
  {
    hosts: [
      'aws.amazon.com',
      'azure.microsoft.com',
      'cloud.google.com',
      'learn.microsoft.com',
      'docs.microsoft.com',
      'portal.azure.com',
    ],
    category: 'nourishing',
    topic: 'Cloud',
  },
  {
    hosts: ['arxiv.org', 'scholar.google.com', 'researchgate.net', 'nature.com', 'sciencedirect.com'],
    category: 'nourishing',
    topic: 'Research',
  },
  {
    hosts: ['coursera.org', 'udemy.com', 'khanacademy.org', 'edx.org', 'pluralsight.com'],
    category: 'nourishing',
    topic: 'Learning',
  },
  {
    hosts: ['wikipedia.org', 'wikimedia.org'],
    category: 'nourishing',
    topic: 'Reference',
  },
];

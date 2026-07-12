import { GITHUB_URL } from '../site-meta';

export {
  CHROME_STORE_URL,
  GITHUB_URL,
  POUYAN_RAZIAN_NAME,
  POUYAN_RAZIAN_URL,
  SITE_NAME,
  SITE_URL,
  YANOVIAN_LLC_NAME,
  YANOVIAN_LLC_URL,
} from '../site-meta';

export const PRIVACY_PATH = 'privacy';

export const TERMS_PATH = 'terms';

export const PRIVACY_REPO_URL = `${GITHUB_URL}/blob/master/PRIVACY.md`;

export const TERMS_REPO_URL = `${GITHUB_URL}/blob/master/TERMS.md`;

/** @deprecated Use in-site `/privacy` or {@link PRIVACY_REPO_URL} for the authoritative copy. */
export const PRIVACY_URL = PRIVACY_REPO_URL;

/** How long each hero tab scene stays visible (ms). */
export const HERO_SCENE_MS = 8_000;

/** Crossfade / slide between hero scenes (ms). */
export const HERO_TRANSITION_MS = 700;

export const heroSceneDefs = [
  { id: 'happy', key: 'Happy', lottie: 'lottie/happy.json' },
  { id: 'play', key: 'Play', lottie: 'lottie/playing.json' },
  { id: 'feed', key: 'Feed', lottie: 'lottie/feeding.json' },
  { id: 'curious', key: 'Curious', lottie: 'lottie/curious.json' },
] as const;

export const featureDefs = [
  { id: 'floating', key: 'Floating', lottie: 'lottie/idle.json' },
  { id: 'care', key: 'Care', lottie: 'lottie/happy.json' },
  { id: 'feeding', key: 'Feeding', lottie: 'lottie/feeding.json' },
  { id: 'play', key: 'Play', lottie: 'lottie/playing.json' },
  { id: 'peek', key: 'Peek', lottie: 'lottie/peek.json' },
  { id: 'grow', key: 'Grow', lottie: 'lottie/newborn.json' },
] as const;

export const privacyPointKeys = [
  'privacyPoint1',
  'privacyPoint2',
  'privacyPoint3',
  'privacyPoint4',
] as const;

export const moodDefs = [
  { key: 'Hungry', tone: 'warm' },
  { key: 'Happy', tone: 'gold' },
  { key: 'Stressed', tone: 'rose' },
  { key: 'Sleepy', tone: 'violet' },
  { key: 'Curious', tone: 'mint' },
] as const;

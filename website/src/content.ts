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

export const heroScenes = [
  {
    id: 'happy',
    tab: 'Morning inbox',
    lottie: 'lottie/happy.json',
    speech: 'Pet me?',
    alt: 'Tabby feeling happy',
  },
  {
    id: 'play',
    tab: 'Break time',
    lottie: 'lottie/playing.json',
    speech: 'Play with me!',
    alt: 'Tabby playing',
  },
  {
    id: 'feed',
    tab: 'Snack o’clock',
    lottie: 'lottie/feeding.json',
    speech: 'Got a treat?',
    alt: 'Tabby eating a treat',
  },
  {
    id: 'curious',
    tab: 'Late-night scroll',
    lottie: 'lottie/curious.json',
    speech: 'Still here with you',
    alt: 'Tabby looking curious',
  },
] as const;

export const features = [
  {
    title: 'Floating companion',
    body: 'Tabby appears on the pages you visit. Drag her anywhere you like.',
    lottie: 'lottie/idle.json',
  },
  {
    title: 'Care menu',
    body: 'Tap to pet, feed, play, or ask what is up. She answers in a speech bubble.',
    lottie: 'lottie/happy.json',
  },
  {
    title: 'Feeding moments',
    body: 'Short treat scenes when her belly is empty and you share a snack.',
    lottie: 'lottie/feeding.json',
  },
  {
    title: 'Play until wild',
    body: 'Wind her up with play time. She has moods that match the moment.',
    lottie: 'lottie/playing.json',
  },
  {
    title: 'Peeks and murmurs',
    body: 'She may wander in from the edge or whisper a silly line while you browse.',
    lottie: 'lottie/peek.json',
  },
  {
    title: 'Grows with you',
    body: 'Newborn kitten, playful teen, then adult cat over real calendar weeks.',
    lottie: 'lottie/newborn.json',
  },
] as const;

export const privacyPoints = [
  'Reads only the active tab title and web address',
  'Never reads page body text or browsing history',
  'No accounts, analytics, or cloud',
  'Everything stays on your device',
] as const;

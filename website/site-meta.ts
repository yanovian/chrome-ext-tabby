/** Public site URL without trailing slash (GitHub Pages). */
export const SITE_ORIGIN = 'https://yanovian.github.io';

/** Repo path segment on GitHub Pages. */
export const SITE_REPO_PATH = 'chrome-ext-tabby';

export const SITE_URL = `${SITE_ORIGIN}/${SITE_REPO_PATH}/`;

export const SITE_NAME = 'Tabby';

export const CHROME_STORE_URL =
  'https://chromewebstore.google.com/detail/tabby/bgjfofaekhihaeafccchijbakkhlcngb';

export const GITHUB_URL = 'https://github.com/yanovian/chrome-ext-tabby';

export const OG_IMAGE_PATH = 'og-image.png';

export const OG_IMAGE_WIDTH = 1200;

export const OG_IMAGE_HEIGHT = 630;

export function absoluteAssetUrl(assetPath: string): string {
  const path = assetPath.startsWith('/') ? assetPath.slice(1) : assetPath;
  return new URL(path, SITE_URL).href;
}

import {
  absoluteAssetUrl,
  CHROME_STORE_URL,
  GITHUB_URL,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_PATH,
  OG_IMAGE_WIDTH,
  SITE_NAME,
  SITE_URL,
} from '../../site-meta';
import { useHead } from '@unhead/react';
import { defineSoftwareApp, defineWebSite, useSchemaOrg } from '@unhead/schema-org/react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '@/i18n';

function ogLocale(language: string): string {
  if (language === 'en') {
    return 'en_US';
  }
  const [lang, region] = language.split('-');
  return region ? `${lang}_${region.toUpperCase()}` : `${lang}_${lang.toUpperCase()}`;
}

export function Seo() {
  const { t, i18n } = useTranslation('seo');
  const title = t('title');
  const description = t('description');
  const ogImage = absoluteAssetUrl(OG_IMAGE_PATH);
  const ogImageAlt = t('ogImageAlt');
  const locale = ogLocale(i18n.resolvedLanguage ?? 'en');

  useHead({
    htmlAttrs: { lang: i18n.resolvedLanguage ?? 'en' },
    title,
    meta: [
      { name: 'description', content: description },
      { name: 'author', content: SITE_NAME },
      { name: 'robots', content: 'index, follow' },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: SITE_NAME },
      { property: 'og:locale', content: locale },
      { property: 'og:url', content: SITE_URL },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:image', content: ogImage },
      { property: 'og:image:width', content: String(OG_IMAGE_WIDTH) },
      { property: 'og:image:height', content: String(OG_IMAGE_HEIGHT) },
      { property: 'og:image:alt', content: ogImageAlt },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: ogImage },
      { name: 'twitter:image:alt', content: ogImageAlt },
    ],
    link: [
      { rel: 'canonical', href: SITE_URL },
      { rel: 'apple-touch-icon', href: absoluteAssetUrl('icon.png') },
      ...SUPPORTED_LANGUAGES.map((language) => ({
        rel: 'alternate',
        hreflang: language,
        href: SITE_URL,
      })),
      { rel: 'alternate', hreflang: 'x-default', href: SITE_URL },
    ],
  });

  useSchemaOrg([
    defineWebSite({
      name: SITE_NAME,
      url: SITE_URL,
      inLanguage: i18n.resolvedLanguage ?? 'en',
    }),
    defineSoftwareApp({
      name: SITE_NAME,
      applicationCategory: 'BrowserApplication',
      operatingSystem: 'Chrome',
      description,
      url: SITE_URL,
      downloadUrl: CHROME_STORE_URL,
      image: ogImage,
      offers: {
        price: 0,
        priceCurrency: 'USD',
      },
      author: {
        name: SITE_NAME,
        url: GITHUB_URL,
      },
    }),
  ]);

  return null;
}

import {
  absoluteAssetUrl,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_PATH,
  OG_IMAGE_WIDTH,
  SITE_NAME,
  YANOVIAN_LLC_NAME,
  sitePageUrl,
} from '../../site-meta';
import { useHead } from '@unhead/react';
import { defineWebPage, useSchemaOrg } from '@unhead/schema-org/react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '@/i18n';

type PageSeoProps = {
  pageKey: 'privacy' | 'terms';
  path: string;
};

function ogLocale(language: string): string {
  if (language === 'en') {
    return 'en_US';
  }
  const [lang, region] = language.split('-');
  return region ? `${lang}_${region.toUpperCase()}` : `${lang}_${lang.toUpperCase()}`;
}

export function PageSeo({ pageKey, path }: PageSeoProps) {
  const { t, i18n } = useTranslation('seo');
  const title = t(`${pageKey}.title`);
  const description = t(`${pageKey}.description`);
  const ogImage = absoluteAssetUrl(OG_IMAGE_PATH);
  const ogImageAlt = t('ogImageAlt');
  const locale = ogLocale(i18n.resolvedLanguage ?? 'en');
  const canonical = sitePageUrl(path);

  useHead({
    htmlAttrs: { lang: i18n.resolvedLanguage ?? 'en' },
    title,
    meta: [
      { name: 'description', content: description },
      { name: 'author', content: YANOVIAN_LLC_NAME },
      { name: 'robots', content: 'index, follow' },
      { property: 'og:type', content: 'article' },
      { property: 'og:site_name', content: SITE_NAME },
      { property: 'og:locale', content: locale },
      { property: 'og:url', content: canonical },
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
      { rel: 'canonical', href: canonical },
      { rel: 'apple-touch-icon', href: absoluteAssetUrl('icon.png') },
      ...SUPPORTED_LANGUAGES.map((language) => ({
        rel: 'alternate',
        hreflang: language,
        href: canonical,
      })),
      { rel: 'alternate', hreflang: 'x-default', href: canonical },
    ],
  });

  useSchemaOrg([
    defineWebPage({
      name: title,
      description,
      url: canonical,
      inLanguage: i18n.resolvedLanguage ?? 'en',
    }),
  ]);

  return null;
}

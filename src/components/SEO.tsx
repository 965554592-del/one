import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

const SITE_URL = 'https://autoparts.fit';
const SUPPORTED_LANGS = ['en', 'zh'] as const;

interface SEOProps {
  title: string;
  description: string;
  /** Canonical path (without origin), e.g. "/products". Defaults to current location pathname. */
  path?: string;
  /** Absolute or relative image URL for og:image. */
  image?: string;
  /** schema.org JSON-LD payload. */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  /** Override og:type. Default "website" (or "product" can be passed). */
  type?: string;
}

/**
 * Renders <head> tags for SEO: title, description, canonical, hreflang, OpenGraph,
 * Twitter Card, and optional JSON-LD structured data.
 */
export default function SEO({ title, description, path, image, jsonLd, type = 'website' }: SEOProps) {
  const { i18n } = useTranslation();
  const location = useLocation();
  const currentPath = path ?? location.pathname;
  const url = `${SITE_URL}${currentPath}`;
  const lang = (i18n.language || 'en').split('-')[0];
  const ogImage = image
    ? (image.startsWith('http') ? image : `${SITE_URL}${image.startsWith('/') ? image : `/${image}`}`)
    : `${SITE_URL}/favicon.png`;

  return (
    <Helmet>
      <html lang={lang} />
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />

      {/* hreflang: same path for each supported language. */}
      {SUPPORTED_LANGS.map((l) => (
        <link key={l} rel="alternate" hrefLang={l} href={url} />
      ))}
      <link rel="alternate" hrefLang="x-default" href={url} />

      {/* OpenGraph */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content="Vida Auto" />
      <meta property="og:locale" content={lang === 'zh' ? 'zh_CN' : 'en_US'} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {jsonLd ? (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      ) : null}
    </Helmet>
  );
}

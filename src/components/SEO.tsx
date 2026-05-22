import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { organizationSchema, breadcrumbSchema, BreadcrumbItem } from '../lib/schema';

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
  /** When true, instruct search engines not to index this page (used for filter/query pages). */
  noindex?: boolean;
  /** Breadcrumb trail; will be emitted as BreadcrumbList JSON-LD. */
  breadcrumbs?: BreadcrumbItem[];
  /** When true, omit the global Organization JSON-LD (e.g., on the home page that already declares it). */
  omitOrganization?: boolean;
}

/**
 * Renders <head> tags for SEO: title, description, canonical, hreflang, OpenGraph,
 * Twitter Card, and optional JSON-LD structured data.
 */
export default function SEO({ title, description, path, image, jsonLd, type = 'website', noindex = false, breadcrumbs, omitOrganization = false }: SEOProps) {
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
      {noindex && <meta name="robots" content="noindex, follow" />}
      <link rel="canonical" href={url} />

      {/*
        hreflang strategy for an SPA serving multiple languages on the same URL:
        - x-default points to the canonical URL (English version is primary).
        - Each supported language gets a hreflang tag pointing to the same URL with
          a `?hl=xx` hint so Google can distinguish content variants without producing
          duplicate indexable URLs (canonical still pins to the clean URL).
      */}
      <link rel="alternate" hrefLang="x-default" href={url} />
      {SUPPORTED_LANGS.map((l) => (
        <link key={l} rel="alternate" hrefLang={l} href={`${url}${url.includes('?') ? '&' : '?'}hl=${l}`} />
      ))}

      {/* OpenGraph */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content="Vida Auto" />
      <meta property="og:locale" content={lang === 'zh' ? 'zh_CN' : 'en_US'} />
      <meta property="og:locale:alternate" content={lang === 'zh' ? 'en_US' : 'zh_CN'} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* Per-page JSON-LD (Product, Article, FAQ, etc.) */}
      {jsonLd ? (
        Array.isArray(jsonLd) ? (
          jsonLd.map((item, idx) => (
            <script key={`ld-${idx}`} type="application/ld+json">{JSON.stringify(item)}</script>
          ))
        ) : (
          <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
        )
      ) : null}

      {/* BreadcrumbList JSON-LD */}
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema(breadcrumbs))}</script>
      ) : null}

      {/* Global Organization JSON-LD (rendered on every page unless suppressed) */}
      {!omitOrganization ? (
        <script type="application/ld+json">{JSON.stringify(organizationSchema())}</script>
      ) : null}
    </Helmet>
  );
}

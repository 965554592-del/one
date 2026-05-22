/* eslint-disable no-console */
// Generates dist/sitemap.xml and dist/robots.txt after the build.
// Pulls product IDs from Firestore using the public web SDK config.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');

const SITE_URL = 'https://autoparts.fit';

// Static routes: [path, changefreq, priority]
const STATIC_ROUTES = [
  ['/', 'daily', 1.0],
  ['/products', 'daily', 0.9],
  ['/about', 'monthly', 0.6],
  ['/factory', 'monthly', 0.7],
  ['/blog', 'weekly', 0.7],
  ['/ship-to', 'monthly', 0.5],
];

/** Initialise Firestore (web SDK) from the project config. */
async function getDb() {
  const cfgRaw = await fs.readFile(path.join(root, 'firebase-applet-config.json'), 'utf8');
  const cfg = JSON.parse(cfgRaw);
  const { initializeApp } = await import('firebase/app');
  const { getFirestore } = await import('firebase/firestore');
  const app = initializeApp(cfg);
  return cfg.firestoreDatabaseId
    ? getFirestore(app, cfg.firestoreDatabaseId)
    : getFirestore(app);
}

async function loadDynamicRoutes(db) {
  const { collection, getDocs, query, where } = await import('firebase/firestore');
  const routes = [];

  // Product detail pages
  try {
    const snap = await getDocs(collection(db, 'products'));
    snap.forEach((d) => {
      const data = d.data();
      const lastmod = (data.updatedAt || data.createdAt || '').slice(0, 10) || undefined;
      routes.push({ path: `/products/${d.id}`, changefreq: 'weekly', priority: 0.8, lastmod });
    });
    console.log(`  Products: ${snap.size}`);
  } catch (err) {
    console.warn('[sitemap] products skipped:', err?.message);
  }

  // Published blog posts
  try {
    const snap = await getDocs(query(collection(db, 'posts'), where('published', '==', true)));
    snap.forEach((d) => {
      const data = d.data();
      const slug = data.slug || d.id;
      const lastmod = (data.updatedAt || data.createdAt || '').slice(0, 10) || undefined;
      routes.push({ path: `/blog/${slug}`, changefreq: 'monthly', priority: 0.6, lastmod });
    });
    console.log(`  Blog posts: ${snap.size}`);
  } catch (err) {
    console.log('  (no published blog posts, skipping)');
  }

  // Ship-to region pages
  try {
    const snap = await getDocs(collection(db, 'salesRegions'));
    snap.forEach((d) => {
      const name = d.data().name || '';
      const slug = name.toLowerCase().replace(/\s+/g, '-');
      if (slug) routes.push({ path: `/ship-to/${slug}`, changefreq: 'monthly', priority: 0.5 });
    });
    console.log(`  Regions: ${snap.size}`);
  } catch (err) {
    console.log('  (no regions, skipping)');
  }

  return routes;
}

function urlEntry(loc, { changefreq = 'weekly', priority = 0.7, lastmod } = {}) {
  const date = lastmod || new Date().toISOString().slice(0, 10);
  return [
    '  <url>',
    `    <loc>${loc}</loc>`,
    `    <lastmod>${date}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    '  </url>',
  ].join('\n');
}

async function main() {
  console.log('[sitemap] Generating...');
  let dynamicRoutes = [];
  try {
    const db = await getDb();
    dynamicRoutes = await loadDynamicRoutes(db);
  } catch (err) {
    console.warn('[sitemap] Could not connect to Firestore:', err?.message);
  }

  const allEntries = [
    // Static pages
    ...STATIC_ROUTES.map(([p, cf, pr]) =>
      urlEntry(`${SITE_URL}${p === '/' ? '' : p}`, { changefreq: cf, priority: pr })
    ),
    // Dynamic pages (products, blog, regions)
    ...dynamicRoutes.map((r) =>
      urlEntry(`${SITE_URL}${r.path}`, { changefreq: r.changefreq, priority: r.priority, lastmod: r.lastmod })
    ),
  ];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...allEntries,
    '</urlset>',
    '',
  ].join('\n');

  await fs.mkdir(distDir, { recursive: true });
  await fs.writeFile(path.join(distDir, 'sitemap.xml'), xml, 'utf8');
  console.log(`[sitemap] ✓ wrote ${allEntries.length} URLs to dist/sitemap.xml`);

  // robots.txt — per Google guidelines + AI crawler strategy
  const robots = [
    `# robots.txt - ${SITE_URL}`,
    '# Reference: https://developers.google.com/search/docs/crawling-indexing/robots/create-robots-txt',
    '',
    '# Default rules for all crawlers',
    'User-agent: *',
    'Allow: /',
    'Disallow: /products?',
    'Disallow: /admin',
    'Disallow: /debug',
    'Disallow: /user',
    '',
    '# Search engine crawlers - full access',
    'User-agent: Googlebot',
    'Allow: /',
    'Disallow: /products?',
    'Disallow: /admin',
    'Disallow: /debug',
    'Disallow: /user',
    '',
    'User-agent: Googlebot-Image',
    'Allow: /',
    '',
    '# AdsBot must be explicitly named (wildcard * does not cover it)',
    'User-agent: AdsBot-Google',
    'User-agent: AdsBot-Google-Mobile',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /debug',
    'Disallow: /user',
    '',
    '# AI crawlers - training data blocked, real-time search allowed',
    '# Block model training crawlers',
    'User-agent: GPTBot',
    'Disallow: /',
    '',
    'User-agent: Google-Extended',
    'Disallow: /',
    '',
    'User-agent: ClaudeBot',
    'Disallow: /',
    '',
    'User-agent: CCBot',
    'Disallow: /',
    '',
    'User-agent: Bytespider',
    'Disallow: /',
    '',
    '# Allow AI real-time search/browsing (drives traffic back to site)',
    'User-agent: ChatGPT-User',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /debug',
    'Disallow: /user',
    '',
    'User-agent: PerplexityBot',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /debug',
    'Disallow: /user',
    '',
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    '',
  ].join('\n');
  await fs.writeFile(path.join(distDir, 'robots.txt'), robots, 'utf8');
  console.log('[sitemap] ✓ wrote dist/robots.txt');
}

main().catch((err) => {
  console.error('[sitemap] fatal:', err);
  process.exit(1);
});

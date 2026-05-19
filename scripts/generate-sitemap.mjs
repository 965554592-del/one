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
const STATIC_ROUTES = ['/', '/products', '/about'];

async function loadProductIds() {
  try {
    const cfgRaw = await fs.readFile(path.join(root, 'firebase-applet-config.json'), 'utf8');
    const cfg = JSON.parse(cfgRaw);
    const { initializeApp } = await import('firebase/app');
    const { getFirestore, collection, getDocs } = await import('firebase/firestore');
    const app = initializeApp(cfg);
    const db = cfg.firestoreDatabaseId
      ? getFirestore(app, cfg.firestoreDatabaseId)
      : getFirestore(app);
    const snap = await getDocs(collection(db, 'products'));
    return snap.docs.map((d) => d.id);
  } catch (err) {
    console.warn('[sitemap] Skipping product URLs:', err?.message || err);
    return [];
  }
}

function urlEntry(loc, { changefreq = 'weekly', priority = 0.7 } = {}) {
  const lastmod = new Date().toISOString().slice(0, 10);
  return [
    '  <url>',
    `    <loc>${loc}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    '  </url>',
  ].join('\n');
}

async function main() {
  const productIds = await loadProductIds();
  const allRoutes = [
    ...STATIC_ROUTES.map((r) => ({
      loc: `${SITE_URL}${r === '/' ? '' : r}`,
      changefreq: r === '/' ? 'daily' : 'weekly',
      priority: r === '/' ? 1.0 : 0.8,
    })),
    ...productIds.map((id) => ({
      loc: `${SITE_URL}/products/${id}`,
      changefreq: 'weekly',
      priority: 0.6,
    })),
  ];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...allRoutes.map((r) => urlEntry(r.loc, { changefreq: r.changefreq, priority: r.priority })),
    '</urlset>',
    '',
  ].join('\n');

  await fs.mkdir(distDir, { recursive: true });
  await fs.writeFile(path.join(distDir, 'sitemap.xml'), xml, 'utf8');
  console.log(`[sitemap] ✓ wrote ${allRoutes.length} URLs to dist/sitemap.xml`);

  const robots = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
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

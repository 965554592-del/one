/* eslint-disable no-console */
// Post-build prerenderer.
// 1. Spins up a static file server over the existing dist/ folder.
// 2. Uses puppeteer to load each route, lets React render & Helmet inject head tags.
// 3. Captures the resulting HTML and writes dist/<route>/index.html.
//
// Routes are listed below; product detail pages are pulled from Firestore (read-only)
// using the public web SDK. If Firestore is unreachable we skip product pages but
// still prerender the static routes.
//
// Apache .htaccess SPA fallback still serves these static HTMLs first when a crawler
// hits them, then React rehydrates on the client.

import http from 'node:http';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import handler from 'serve-handler';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');

const STATIC_ROUTES = ['/', '/products', '/about'];

async function loadProductIds() {
  // Lazy import to avoid bundling Firebase if unused.
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
    return snap.docs.map((d) => d.id).slice(0, 100); // safety cap
  } catch (err) {
    console.warn('[prerender] Skipping product detail pages:', err?.message || err);
    return [];
  }
}

/**
 * Removes duplicate head tags introduced by Helmet + static index.html overlap.
 * Strategy: split each opening-tag occurrence inside <head>, group by a normalized
 * key, keep only the last occurrence (latest Helmet render wins). Also collapses
 * duplicate <title> tags to a single one.
 */
function dedupeHead(html) {
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  if (!headMatch) return html;
  const headInner = headMatch[1];

  // Tokenize head into top-level tags + interleaved whitespace/comments.
  // Greedy match for the head's known tag types we want to dedupe.
  const tagRegex = /<(title|meta|link)\b[^>]*>(?:[\s\S]*?<\/\1>)?/gi;
  const tokens = [];
  let lastIndex = 0;
  let m;
  while ((m = tagRegex.exec(headInner)) !== null) {
    if (m.index > lastIndex) tokens.push({ type: 'raw', text: headInner.slice(lastIndex, m.index) });
    tokens.push({ type: 'tag', tagName: m[1].toLowerCase(), text: m[0] });
    lastIndex = tagRegex.lastIndex;
  }
  if (lastIndex < headInner.length) tokens.push({ type: 'raw', text: headInner.slice(lastIndex) });

  // Walk left->right, for tag types we dedupe by key keep only LAST.
  // Strategy: walk right->left, mark first-seen-from-right as keep, drop rest.
  const keyFor = (tag) => {
    if (tag.tagName === 'title') return 'title';
    if (tag.tagName === 'meta') {
      const name = (tag.text.match(/\sname=["']([^"']+)/i) || [])[1];
      const prop = (tag.text.match(/\sproperty=["']([^"']+)/i) || [])[1];
      const httpEquiv = (tag.text.match(/\shttp-equiv=["']([^"']+)/i) || [])[1];
      const charset = /\scharset=/i.test(tag.text) ? 'charset' : null;
      const k = name || prop || httpEquiv || charset;
      return k ? `meta:${k.toLowerCase()}` : null;
    }
    if (tag.tagName === 'link') {
      const rel = (tag.text.match(/\srel=["']([^"']+)/i) || [])[1] || '';
      const hreflang = (tag.text.match(/\shreflang=["']([^"']+)/i) || [])[1];
      const sizes = (tag.text.match(/\ssizes=["']([^"']+)/i) || [])[1];
      const type = (tag.text.match(/\stype=["']([^"']+)/i) || [])[1];
      // For canonical/manifest etc dedupe by rel only.
      // For hreflang dedupe by rel+hreflang. For icon variants dedupe by rel+sizes+type.
      if (rel === 'alternate' && hreflang) return `link:alternate:${hreflang.toLowerCase()}`;
      if (rel === 'icon' || rel === 'apple-touch-icon') return `link:${rel.toLowerCase()}:${sizes || ''}:${type || ''}`;
      if (rel === 'canonical' || rel === 'manifest') return `link:${rel.toLowerCase()}`;
      return null; // Don't dedupe stylesheets, preloads, modulepreloads, etc.
    }
    return null;
  };

  // Helmet prepends <title> but appends <meta>/<link> to <head>. So for titles
  // we keep the FIRST occurrence (left-to-right), for meta/link we keep the LAST.
  const seenTitle = new Set();
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type !== 'tag' || t.tagName !== 'title') continue;
    const k = keyFor(t);
    if (!k) continue;
    if (seenTitle.has(k)) t.drop = true; else seenTitle.add(k);
  }
  const seenRest = new Set();
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i];
    if (t.type !== 'tag' || t.tagName === 'title' || t.drop) continue;
    const k = keyFor(t);
    if (!k) continue;
    if (seenRest.has(k)) t.drop = true; else seenRest.add(k);
  }

  const newHead = tokens
    .filter((t) => !t.drop)
    .map((t) => t.text)
    .join('');

  return html.slice(0, headMatch.index) + `<head>${newHead}</head>` + html.slice(headMatch.index + headMatch[0].length);
}

/**
 * Replaces inline base64 `data:image/...;base64,...` URIs in img/video/source
 * src/href attributes with a small placeholder. Some products store full
 * binary images inside Firestore as data URIs which inflates prerendered HTML
 * to several MB; the real client app re-fetches the data and renders the
 * actual images after hydration.
 */
function stripInlineDataUris(html) {
  // Match data: URIs over 200 chars (avoids tiny inline SVG icons used by UI libs).
  return html.replace(/data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]{200,}/g, '/favicon.png');
}

function startStaticServer(port, indexTemplate) {
  // Custom server: serve static files from dist/, but for any unmatched route
  // return the in-memory `indexTemplate` (the ORIGINAL post-vite-build index.html)
  // so prerendered child routes don't reference the home page's hydrated HTML.
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        // Reject path traversal.
        if (urlPath.includes('..')) {
          res.writeHead(400);
          res.end('bad request');
          return;
        }
        // Try to serve a real file from dist/.
        const candidate = path.join(distDir, urlPath === '/' ? '/__never__' : urlPath);
        try {
          const stat = await fs.stat(candidate);
          if (stat.isFile()) {
            return handler(req, res, { public: distDir });
          }
        } catch {
          /* not a file, fall through */
        }
        // Fallback: return original index template for SPA routing.
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(indexTemplate);
      } catch (err) {
        res.writeHead(500);
        res.end(String(err));
      }
    });
    server.on('error', reject);
    server.listen(port, () => resolve(server));
  });
}

async function prerenderRoute(browser, baseUrl, route) {
  const page = await browser.newPage();
  try {
    page.setDefaultNavigationTimeout(30_000);
    // Block long-lived connections (Firestore listeners, analytics) so the
    // page reaches network idle. The frontend will reconnect normally on
    // real clients after rehydration.
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      // Block analytics; allow Firebase so product data can load.
      if (url.includes('google-analytics.com') || url.includes('googletagmanager.com')) {
        return req.abort();
      }
      req.continue();
    });

    await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
    // Wait for React to mount and either render an h1 or a not-found marker.
    await page
      .waitForFunction(
        () => {
          const root = document.getElementById('root');
          return !!root && root.textContent && root.textContent.length > 50;
        },
        { timeout: 15_000 },
      )
      .catch(() => {});
    // Settle window for Firestore-driven data + Helmet flush.
    await new Promise((r) => setTimeout(r, 4000));

    const html = stripInlineDataUris(dedupeHead(await page.content()));
    const target = route === '/' ? path.join(distDir, 'index.html') : path.join(distDir, route, 'index.html');
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, html, 'utf8');
    console.log(`[prerender] ✓ ${route} -> ${path.relative(root, target)}`);
  } finally {
    await page.close();
  }
}

async function main() {
  // Verify dist/index.html exists.
  await fs.access(path.join(distDir, 'index.html')).catch(() => {
    throw new Error('dist/index.html not found. Run vite build first.');
  });

  const productIds = await loadProductIds();
  const productRoutes = productIds.map((id) => `/products/${id}`);
  const allRoutes = [...STATIC_ROUTES, ...productRoutes];

  console.log(`[prerender] ${allRoutes.length} route(s) to render`);

  // Snapshot the original (pre-prerender) index.html in memory so the SPA
  // template never includes already-prerendered home page content.
  const indexTemplate = await fs.readFile(path.join(distDir, 'index.html'), 'utf8');

  const port = 4173 + Math.floor(Math.random() * 100);
  const server = await startStaticServer(port, indexTemplate);
  const baseUrl = `http://127.0.0.1:${port}`;

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    for (const route of allRoutes) {
      try {
        await prerenderRoute(browser, baseUrl, route);
      } catch (err) {
        console.error(`[prerender] ✗ ${route}:`, err?.message || err);
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error('[prerender] fatal:', err);
  process.exit(1);
});

// Keep an unused import for handler typings (silences bundler complaints).
void createReadStream;

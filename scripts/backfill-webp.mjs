/**
 * Backfill script: convert all existing JPEG/PNG images in Firebase Storage
 * to WebP, then rewrite every Firestore document that references the old URL.
 *
 * ── Prerequisites ──────────────────────────────────────────────────────────
 *   1. Download a service account key JSON from
 *      Firebase Console > Project Settings > Service Accounts > Generate new private key
 *      Save it to:   ./scripts/service-account.json  (gitignored)
 *
 *   2. Install deps (one-off):
 *        npm i -D firebase-admin sharp
 *
 *   3. Verify the bucket + database IDs in CONFIG below match your project
 *      (read from firebase-applet-config.json automatically).
 *
 * ── Usage ──────────────────────────────────────────────────────────────────
 *   Dry-run (recommended first pass — prints what WOULD happen):
 *     node scripts/backfill-webp.mjs
 *
 *   Apply (actually convert + rewrite Firestore + delete originals):
 *     node scripts/backfill-webp.mjs --apply
 *
 *   Apply but keep original files (safer, doubles storage):
 *     node scripts/backfill-webp.mjs --apply --keep-originals
 *
 *   Only process a subset of prefixes (faster smoke test):
 *     node scripts/backfill-webp.mjs --apply --prefix=site-settings/
 *
 * ── What it does ───────────────────────────────────────────────────────────
 *   • Lists every object under image folders in Storage.
 *   • For each JPEG/PNG, downloads it, recompresses with sharp (max 1920px,
 *     quality 82), uploads <basename>.webp alongside the original.
 *   • Generates a Firebase download URL (with token) for the new file.
 *   • Scans the listed Firestore collections, finds docs containing the old
 *     URL (works for both string and array fields), replaces with the new URL.
 *   • Deletes the original image file (unless --keep-originals).
 *
 * ── Safety ─────────────────────────────────────────────────────────────────
 *   • Default dry-run prints every planned change.
 *   • Idempotent: re-runs skip files already converted (existing .webp).
 *   • Logs every action with size savings.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import admin from 'firebase-admin';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// ─── CONFIG ─────────────────────────────────────────────────────────────────
const appletConfig = JSON.parse(
  fs.readFileSync(path.join(rootDir, 'firebase-applet-config.json'), 'utf-8'),
);
const PROJECT_ID = appletConfig.projectId;
const STORAGE_BUCKET = appletConfig.storageBucket;
const FIRESTORE_DB_ID = appletConfig.firestoreDatabaseId; // e.g. "vida-prod"

// Folders under the bucket that contain user-uploaded images.
const IMAGE_PREFIXES = [
  'products/',
  'certificates/',
  'blog-covers/',
  'brand-logos/',
  'about-sections/',
  'site-settings/',
  'uploads/',
];

// Firestore (collection, field-paths-or-nested-walker) targets that may hold image URLs.
// `walk` returns the same shape but with rewritten URLs (or null if unchanged).
const FIRESTORE_TARGETS = [
  {
    collection: 'products',
    rewrite: (data, replaceUrl) => {
      let changed = false;
      if (Array.isArray(data.imageUrls)) {
        const next = data.imageUrls.map((u) => {
          const r = replaceUrl(u);
          if (r !== u) changed = true;
          return r;
        });
        if (changed) data.imageUrls = next;
      }
      return changed ? data : null;
    },
  },
  {
    collection: 'blogPosts',
    rewrite: (data, replaceUrl) => {
      const next = replaceUrl(data.coverImage);
      if (next !== data.coverImage) {
        data.coverImage = next;
        return data;
      }
      return null;
    },
  },
  {
    collection: 'settings',
    rewrite: (data, replaceUrl) => {
      const stringFields = [
        'logoUrl', 'statsBgUrl', 'heroBgUrl', 'storyBgUrl', 'factoryBgUrl', 'whatsappQrUrl',
      ];
      let changed = false;
      for (const f of stringFields) {
        if (data[f]) {
          const r = replaceUrl(data[f]);
          if (r !== data[f]) {
            data[f] = r;
            changed = true;
          }
        }
      }
      // Arrays of {imageUrl}
      for (const arrField of ['certificates', 'brandLogos']) {
        if (Array.isArray(data[arrField])) {
          data[arrField] = data[arrField].map((item) => {
            if (item?.imageUrl) {
              const r = replaceUrl(item.imageUrl);
              if (r !== item.imageUrl) {
                changed = true;
                return { ...item, imageUrl: r };
              }
            }
            return item;
          });
        }
      }
      // aboutSections: {imageUrl}
      if (Array.isArray(data.aboutSections)) {
        data.aboutSections = data.aboutSections.map((s) => {
          if (s?.imageUrl) {
            const r = replaceUrl(s.imageUrl);
            if (r !== s.imageUrl) {
              changed = true;
              return { ...s, imageUrl: r };
            }
          }
          return s;
        });
      }
      return changed ? data : null;
    },
  },
];

// Sharp encoding params (mirrors the client compressImage())
const MAX_DIM = 1920;
const WEBP_QUALITY = 82;

// ─── ARGS ───────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const KEEP_ORIGINALS = args.includes('--keep-originals');
const PREFIX_FILTER = args.find((a) => a.startsWith('--prefix='))?.slice('--prefix='.length);

const log = (...m) => console.log(...m);
const logDry = (...m) => console.log(APPLY ? '   ' : '[DRY]', ...m);

// ─── INIT ───────────────────────────────────────────────────────────────────
const saPath = path.join(__dirname, 'service-account.json');
if (!fs.existsSync(saPath)) {
  console.error('❌ Missing service account key at scripts/service-account.json');
  console.error('   See header comment for download instructions.');
  process.exit(1);
}
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(fs.readFileSync(saPath, 'utf-8'))),
  projectId: PROJECT_ID,
  storageBucket: STORAGE_BUCKET,
});
const bucket = admin.storage().bucket();
const db = admin.firestore();
if (FIRESTORE_DB_ID) {
  // Use the named database
  db.settings({ databaseId: FIRESTORE_DB_ID });
}

log(`🪣  Bucket:       ${STORAGE_BUCKET}`);
log(`📦  Project:      ${PROJECT_ID}`);
log(`🗄️  Firestore DB: ${FIRESTORE_DB_ID || '(default)'}`);
log(`🔧  Mode:         ${APPLY ? 'APPLY' : 'DRY RUN'}${KEEP_ORIGINALS ? ' (keep originals)' : ''}`);
if (PREFIX_FILTER) log(`📁  Prefix filter: ${PREFIX_FILTER}`);
log('');

// ─── URL HELPERS ────────────────────────────────────────────────────────────
function buildDownloadUrl(filePath, token) {
  const enc = encodeURIComponent(filePath);
  return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${enc}?alt=media&token=${token}`;
}

function extractPathFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  if (!url.includes('firebasestorage.googleapis.com')) return null;
  const m = url.match(/\/o\/([^?]+)/);
  if (!m) return null;
  return decodeURIComponent(m[1]);
}

// ─── MAIN ───────────────────────────────────────────────────────────────────
const urlMap = new Map(); // oldUrl -> newUrl

async function processStorage() {
  const prefixes = PREFIX_FILTER ? [PREFIX_FILTER] : IMAGE_PREFIXES;
  let totalSaved = 0;
  let totalProcessed = 0;
  let totalSkipped = 0;

  for (const prefix of prefixes) {
    log(`\n📁 Scanning ${prefix} ...`);
    const [files] = await bucket.getFiles({ prefix });
    for (const file of files) {
      const name = file.name;
      const lowerName = name.toLowerCase();
      // Skip non-images
      if (!/\.(jpe?g|png|bmp)$/i.test(lowerName)) {
        totalSkipped++;
        continue;
      }
      // Skip if a .webp sibling already exists
      const webpName = name.replace(/\.[^.]+$/, '.webp');
      const [webpExists] = await bucket.file(webpName).exists();
      if (webpExists) {
        logDry(`↪︎ already converted: ${name}`);
        totalSkipped++;
        continue;
      }

      // Download
      const [buffer] = await file.download();
      const beforeKB = buffer.length / 1024;

      // Compress with sharp
      let outBuffer;
      try {
        outBuffer = await sharp(buffer, { failOn: 'none' })
          .rotate()
          .resize({ width: MAX_DIM, height: MAX_DIM, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: WEBP_QUALITY, effort: 4 })
          .toBuffer();
      } catch (err) {
        log(`   ⚠️  sharp failed for ${name}: ${err.message}`);
        totalSkipped++;
        continue;
      }
      const afterKB = outBuffer.length / 1024;
      const savedKB = beforeKB - afterKB;

      if (savedKB < 5) {
        logDry(`= no significant win (${beforeKB.toFixed(0)}KB), skipping ${name}`);
        totalSkipped++;
        continue;
      }

      const ratio = ((1 - afterKB / beforeKB) * 100).toFixed(0);
      logDry(`✓ ${name}  ${beforeKB.toFixed(0)}KB → ${afterKB.toFixed(0)}KB (-${ratio}%)`);

      if (APPLY) {
        const token = crypto.randomUUID();
        const newFile = bucket.file(webpName);
        await newFile.save(outBuffer, {
          contentType: 'image/webp',
          metadata: { metadata: { firebaseStorageDownloadTokens: token } },
        });
        const newUrl = buildDownloadUrl(webpName, token);

        // Try to fetch old token from original file metadata so we can match
        // every URL variant pointing to this same object.
        const [meta] = await file.getMetadata().catch(() => [null]);
        const oldToken = meta?.metadata?.firebaseStorageDownloadTokens;
        const oldUrlExact = oldToken ? buildDownloadUrl(name, oldToken) : null;

        // Register a few URL variants -> newUrl, so the Firestore rewriter can
        // match whichever form is stored.
        if (oldUrlExact) urlMap.set(oldUrlExact, newUrl);
        // Token-less fallback match (we'll do substring match too):
        urlMap.set(`STORAGE_PATH::${name}`, newUrl);
      }

      totalSaved += savedKB;
      totalProcessed++;
    }
  }

  log(`\n📊 Storage summary: processed ${totalProcessed}, skipped ${totalSkipped}, saved ${(totalSaved / 1024).toFixed(1)} MB`);
}

async function rewriteFirestore() {
  if (urlMap.size === 0) {
    log('\n📝 No URL changes to apply to Firestore.');
    return;
  }
  log(`\n📝 Rewriting Firestore references (${urlMap.size} URL entries)...`);

  // Build a helper: given any URL, return its replacement if known.
  function replaceUrl(url) {
    if (!url || typeof url !== 'string') return url;
    if (urlMap.has(url)) return urlMap.get(url);
    // Fallback: match by storage path embedded in URL
    const p = extractPathFromUrl(url);
    if (p) {
      const byPath = urlMap.get(`STORAGE_PATH::${p}`);
      if (byPath) return byPath;
    }
    return url;
  }

  let totalDocsChanged = 0;
  for (const target of FIRESTORE_TARGETS) {
    const snap = await db.collection(target.collection).get();
    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const updated = target.rewrite({ ...data }, replaceUrl);
      if (updated) {
        logDry(`✏️  ${target.collection}/${docSnap.id}`);
        if (APPLY) {
          await docSnap.ref.set(updated, { merge: true });
        }
        totalDocsChanged++;
      }
    }
  }
  log(`\n📊 Firestore summary: ${totalDocsChanged} documents ${APPLY ? 'updated' : 'would be updated'}.`);
}

async function deleteOriginals() {
  if (!APPLY || KEEP_ORIGINALS || urlMap.size === 0) return;
  log('\n🗑️  Deleting original (pre-WebP) files...');
  let deleted = 0;
  for (const key of urlMap.keys()) {
    if (!key.startsWith('STORAGE_PATH::')) continue;
    const oldPath = key.slice('STORAGE_PATH::'.length);
    try {
      await bucket.file(oldPath).delete();
      deleted++;
    } catch (err) {
      log(`   ⚠️  could not delete ${oldPath}: ${err.message}`);
    }
  }
  log(`   removed ${deleted} originals.`);
}

(async () => {
  try {
    await processStorage();
    await rewriteFirestore();
    await deleteOriginals();
    log('\n✅ Done.');
    if (!APPLY) {
      log('\nThis was a dry run. Re-run with --apply to perform the changes.');
    }
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Backfill failed:', err);
    process.exit(1);
  }
})();

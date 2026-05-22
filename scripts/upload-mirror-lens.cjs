/**
 * Upload Mirror_Lens_Catalog_EN.xlsx products into Firestore under
 * the "Exterior Mirror System" category, including front+back images,
 * OEM, fitments, and tech specs.
 *
 * Prerequisites:
 *   - extracted-images/ + extracted-images-meta.json (from extract-source-images.ps1)
 *   - en-extracted-images/ + en-extracted-images-meta.json (from extract-en-xlsx-images.cjs)
 *   - Mirror_Lens_Catalog_EN.xlsx (for text data)
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const admin = require('firebase-admin');

const ROOT = path.join(__dirname, '..');
const SRC_XLSX = path.join(ROOT, 'Mirror_Lens_Catalog_EN.xlsx');

// --- Firebase init -------------------------------------------------
const serviceAccount = require('c:/Users/ASUS/Downloads/gen-lang-client-0915949910-firebase-adminsdk-fbsvc-e9858b8e4e.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'gen-lang-client-0915949910.firebasestorage.app',
});
const db = admin.firestore();
db.settings({ databaseId: 'ai-studio-3112dc56-9c5d-41d4-8544-f79c07c29140' });
const bucket = admin.storage().bucket();

const CATEGORY_ID = 'rjXKvuFwkULhaiLlCmvJ';
const CATEGORY_NAME = 'Exterior Mirror System';
const BATCH_SIZE = 4;
const DELAY_MS = 600;
const DRY_RUN = process.argv.includes('--dry-run');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// --- Load image metadata ------------------------------------------
function loadJson(p) {
  let raw = fs.readFileSync(p, 'utf8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  return JSON.parse(raw);
}
const srcMeta = loadJson(path.join(ROOT, 'extracted-images-meta.json'));
const enMeta = loadJson(path.join(ROOT, 'en-extracted-images-meta.json'));

const enImageBySheetRow = new Map();
for (const e of enMeta) {
  const k = `${e.sheet}::${e.row}`;
  if (!enImageBySheetRow.has(k)) enImageBySheetRow.set(k, []);
  enImageBySheetRow.get(k).push(e.image);
}

// OEM token index
function normalizeOem(s) {
  return (s || '').toString().toUpperCase().replace(/[\s\n\r]+/g, '').replace(/[^A-Z0-9/:.-]/g, '');
}
function oemTokens(s) {
  const norm = normalizeOem(s);
  return norm.split(/[/:LR]/).filter(p => p.length >= 5);
}
function nameKeywords(s) {
  if (!s) return [];
  return Array.from(new Set(s.toUpperCase().match(/[A-Z0-9]{3,8}/g) || []))
    .filter(t => /[A-Z]/.test(t) && /\d/.test(t));
}

const tokenIndex = new Map();
for (const entry of srcMeta) {
  for (const t of oemTokens(entry.oem)) if (!tokenIndex.has(t)) tokenIndex.set(t, entry);
}
const nameIndex = new Map();
for (const entry of srcMeta) {
  for (const kw of nameKeywords(entry.name)) {
    if (!nameIndex.has(kw)) nameIndex.set(kw, []);
    nameIndex.get(kw).push(entry);
  }
}
const usedSourceRows = new Set();

function findImagesFor(sheetName, rowIdx0, name, oem) {
  // 1) Source OEM match
  for (const t of oemTokens(oem)) {
    if (tokenIndex.has(t)) {
      const c = tokenIndex.get(t);
      if (!usedSourceRows.has(c.row)) { usedSourceRows.add(c.row); return c.images.slice(0, 2); }
    }
  }
  // 2) Source name keyword match
  for (const kw of nameKeywords(name)) {
    const cands = nameIndex.get(kw) || [];
    const free = cands.find(c => !usedSourceRows.has(c.row));
    if (free) { usedSourceRows.add(free.row); return free.images.slice(0, 2); }
  }
  // 3) Fallback to original EN xlsx single image
  return (enImageBySheetRow.get(`${sheetName}::${rowIdx0 + 1}`) || []).slice(0, 2);
}

// --- Parse fitments from Product Name + Year ----------------------
/**
 * The English catalog stores fitment info in two columns:
 *   - Product Name (col 2): e.g. "Volkswagen Bora / Golf6GTR / Passat Lingyu / Touran"
 *   - Year (col 4): e.g. "Bora: 2013-2015 / Golf6GTR: 2009-2011 / Touran:2011-2015"
 *
 * Strategy: split year column on "/" to extract model-year pairs.
 */
function parseFitments(productName, yearText, sheetName) {
  const fitments = [];
  const make = sheetName.replace(/-.*$/, '').trim(); // "Chevrolet-GMC" -> "Chevrolet"
  if (!yearText) {
    if (productName) fitments.push({ make, displayName: `${make} ${productName}`.trim() });
    return fitments;
  }
  // Vehicle groups are separated by " / " (slash with surrounding whitespace).
  // Within a group, multiple model variants share one year range: "A4/A4L/B8:2009-2012".
  const groups = yearText.split(/\s+\/\s+/);
  for (const group of groups) {
    const m = group.match(/^([^:：]+?)\s*[:：]\s*(.+)$/);
    if (m) {
      const modelsRaw = m[1].trim();
      const yr = m[2].trim();
      // Expand each model in the group as its own fitment
      const models = modelsRaw.split(/\s*\/\s*/).filter(Boolean);
      for (const model of models) {
        fitments.push({ make, model, year: yr, displayName: `${yr} ${make} ${model}`.trim() });
      }
    } else {
      // No colon: treat as a year range or free-text
      fitments.push({ make, year: group.trim(), displayName: `${group.trim()} ${make} ${productName}`.trim() });
    }
  }
  return fitments;
}

// --- SKU generator ------------------------------------------------
function buildSku(brand, oem, idx) {
  const brandShort = brand.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
  const clean = (oem || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 12).toUpperCase();
  return `MIR-${brandShort}-${clean || 'NA'}-${String(idx).padStart(3, '0')}`;
}

// --- Main ---------------------------------------------------------
async function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY-RUN (no writes)' : 'LIVE upload'}`);
  console.log(`Category: ${CATEGORY_NAME} (${CATEGORY_ID})`);

  const wb = XLSX.readFile(SRC_XLSX, { cellStyles: false, cellFormula: false });
  const products = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws['!ref']) continue;
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    let perBrandIdx = 0;
    for (let r = 0; r < data.length; r++) {
      const row = data[r];
      if (typeof row[0] !== 'number' || row[0] <= 0) continue;
      perBrandIdx++;

      const name      = (row[2] || '').toString().trim();
      const oem       = (row[3] || '').toString().trim();
      const year      = (row[4] || '').toString().trim();
      const func      = (row[5] || '').toString().trim();
      const material  = (row[6] || '').toString().trim();
      const pkgSize   = (row[7] || '').toString().trim();
      const weight    = (row[8] || '').toString().trim();

      const images = findImagesFor(sheetName, r, name, oem);
      const fitments = parseFitments(name, year, sheetName);
      const sku = buildSku(sheetName, oem, perBrandIdx);

      const compatibilityText = [year, func].filter(Boolean).join(' | ');
      const techSpecs = {
        material: material || '',
        weight: weight ? `${weight} g` : '',
        compatibility: compatibilityText,
      };

      const brandShort = sheetName.replace(/-.*$/, '');
      const nameHasBrand = name.toLowerCase().includes(brandShort.toLowerCase());
      const fullName = nameHasBrand ? `${name} Mirror Lens` : `${brandShort} ${name} Mirror Lens`;

      products.push({
        sku,
        name: fullName,
        brand: sheetName,
        oemNumber: oem,
        function: func,
        pkgSize,
        images, // local paths
        fitments,
        techSpecs,
      });
    }
  }

  console.log(`\nTotal products to upload: ${products.length}`);
  const withFront = products.filter(p => p.images.length >= 1).length;
  const withBoth = products.filter(p => p.images.length >= 2).length;
  const noImg = products.filter(p => p.images.length === 0).length;
  console.log(`  With both front+back: ${withBoth}`);
  console.log(`  With at least one image: ${withFront}`);
  console.log(`  No image: ${noImg}`);

  if (DRY_RUN) {
    console.log('\n--- Sample (first 3 products) ---');
    for (const p of products.slice(0, 3)) {
      console.log(JSON.stringify({ ...p, images: p.images.map(i => path.basename(i)) }, null, 2));
    }
    process.exit(0);
  }

  // --- Upload loop ------------------------------------------------
  let ok = 0, fail = 0;
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (p) => {
      try {
        const imageUrls = [];
        for (let j = 0; j < p.images.length; j++) {
          const localPath = path.join(ROOT, p.images[j]);
          if (!fs.existsSync(localPath)) continue;
          const ext = path.extname(localPath).toLowerCase() || '.png';
          const destPath = `products/${p.sku}/${j === 0 ? 'front' : 'back'}${ext}`;
          const file = bucket.file(destPath);
          await file.save(fs.readFileSync(localPath), {
            metadata: { contentType: ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png' },
          });
          await file.makePublic();
          imageUrls.push(`https://storage.googleapis.com/${bucket.name}/${destPath}`);
        }

        const doc = {
          sku: p.sku,
          name: p.name,
          categoryId: CATEGORY_ID,
          categoryName: CATEGORY_NAME,
          price: 0,
          oemNumber: p.oemNumber,
          imageUrls,
          techSpecs: p.techSpecs,
          fitments: p.fitments,
          brand: p.brand,
          createdAt: new Date().toISOString(),
        };
        if (p.pkgSize) doc.packagingSize = p.pkgSize;
        if (p.function) doc.function = p.function;

        await db.collection('products').add(doc);
        ok++;
      } catch (err) {
        fail++;
        console.error(`FAIL [${p.sku}]: ${err.message}`);
      }
    }));
    console.log(`Progress: ${Math.min(i + BATCH_SIZE, products.length)}/${products.length} (ok=${ok}, fail=${fail})`);
    if (i + BATCH_SIZE < products.length) await sleep(DELAY_MS);
  }

  console.log(`\nDone. Uploaded ${ok}, failed ${fail}.`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });

// Rebuild Mirror_Lens_Catalog_EN.xlsx with both front+back images per product.
// Strategy:
//  1. Read source-row metadata (extracted-images-meta.json) which maps each source row
//     (in the Chinese .xls) to its OEM numbers and extracted image files.
//  2. Read the existing English Mirror_Lens_Catalog_EN.xlsx to preserve the
//     translated text content (sheet structure, English names, etc.).
//  3. Match each English product row to its source row via OEM part numbers.
//  4. Use ExcelJS to write a new xlsx where each product row has both extracted
//     images embedded side-by-side in column B (image column).

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const ExcelJS = require('exceljs');

const ROOT = path.join(__dirname, '..');
const SRC_XLSX = path.join(ROOT, 'Mirror_Lens_Catalog_EN.xlsx');
const META_JSON = path.join(ROOT, 'extracted-images-meta.json');
const OUT_XLSX = path.join(ROOT, 'Mirror_Lens_Catalog_EN_v2.xlsx');

let metaRaw = fs.readFileSync(META_JSON, 'utf8');
if (metaRaw.charCodeAt(0) === 0xFEFF) metaRaw = metaRaw.slice(1);
const meta = JSON.parse(metaRaw);

// Fallback: original EN xlsx images, keyed by sheet+row.
const EN_META_JSON = path.join(ROOT, 'en-extracted-images-meta.json');
const enMeta = fs.existsSync(EN_META_JSON) ? JSON.parse(fs.readFileSync(EN_META_JSON, 'utf8')) : [];
const enImageBySheetRow = new Map(); // key: `${sheet}::${row}` -> [imagePath]
for (const e of enMeta) {
  const k = `${e.sheet}::${e.row}`;
  if (!enImageBySheetRow.has(k)) enImageBySheetRow.set(k, []);
  enImageBySheetRow.get(k).push(e.image);
}

/** Normalize OEM string: strip whitespace, uppercase, keep alphanumerics + slashes. */
function normalizeOem(s) {
  return (s || '').toString().toUpperCase().replace(/[\s\n\r]+/g, '').replace(/[^A-Z0-9/:.-]/g, '');
}

/** Extract individual OEM tokens (split on "/" and on "L:"/"R:"). */
function oemTokens(s) {
  const norm = normalizeOem(s);
  // Split on common separators that bracket left/right pairs
  const parts = norm.split(/[/:LR]/).filter(p => p.length >= 5);
  return parts;
}

// Build OEM token index: token -> source row meta entry
const tokenIndex = new Map();
for (const entry of meta) {
  const tokens = oemTokens(entry.oem);
  for (const t of tokens) {
    if (!tokenIndex.has(t)) tokenIndex.set(t, entry);
  }
}
console.log(`Indexed ${tokenIndex.size} unique OEM tokens from source.`);

// Name keyword index for fallback matching. Source Chinese names contain markers
// like model numbers (E46, W205, F30, MK6, E150 etc.) that appear in the English
// product name as well. Build an index keyed by these alphanumeric tokens.
const nameIndex = new Map(); // key: keyword -> array of source entries
const usedSourceRows = new Set();
function nameKeywords(s) {
  if (!s) return [];
  // Keep alphanumeric model designators (3-8 chars with at least one letter+digit mix)
  return Array.from(new Set(s.toUpperCase().match(/[A-Z0-9]{3,8}/g) || []))
    .filter(t => /[A-Z]/.test(t) && /\d/.test(t));
}
for (const entry of meta) {
  for (const kw of nameKeywords(entry.name)) {
    if (!nameIndex.has(kw)) nameIndex.set(kw, []);
    nameIndex.get(kw).push(entry);
  }
}

// Read existing English catalog (text only).
const wbSrc = XLSX.readFile(SRC_XLSX, { cellStyles: false, cellFormula: false });

const wbOut = new ExcelJS.Workbook();
wbOut.creator = 'Vida Auto';
wbOut.created = new Date();

let matchedRows = 0;
let totalProductRows = 0;
let missingMatch = [];

for (const sheetName of wbSrc.SheetNames) {
  const ws = wbSrc.Sheets[sheetName];
  if (!ws['!ref']) continue;
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  const wsOut = wbOut.addWorksheet(sheetName, { views: [{ state: 'frozen', ySplit: 2 }] });

  // Column widths similar to original
  wsOut.columns = [
    { width: 6 },   // A: No.
    { width: 32 },  // B: Image (will hold 2 images side by side)
    { width: 36 },  // C: Product Name
    { width: 28 },  // D: OEM Part Number
    { width: 22 },  // E: Year
    { width: 28 },  // F: Function
    { width: 36 },  // G: Material
    { width: 14 },  // H: Pkg Size
    { width: 10 },  // I: Weight
  ];

  // Default row height; image rows get larger height below
  wsOut.properties.defaultRowHeight = 16;

  for (let r = 0; r < data.length; r++) {
    const row = data[r];
    const excelRow = wsOut.getRow(r + 1);
    for (let c = 0; c < row.length; c++) {
      excelRow.getCell(c + 1).value = row[c];
    }

    // Header rows: bold + alignment
    if (r === 0 || r === 1) {
      excelRow.font = { bold: true, size: r === 0 ? 12 : 10, color: { argb: r === 0 ? 'FFFFB300' : 'FF333333' } };
      excelRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      if (r === 0) {
        wsOut.mergeCells(1, 1, 1, 9);
      }
      excelRow.height = r === 0 ? 24 : 30;
      continue;
    }

    // Product rows: typeof row[0] === 'number'
    if (typeof row[0] !== 'number' || row[0] <= 0) continue;

    totalProductRows++;
    const oem = row[3];
    const tokens = oemTokens(oem);
    let match = null;
    for (const t of tokens) {
      if (tokenIndex.has(t)) {
        const cand = tokenIndex.get(t);
        if (!usedSourceRows.has(cand.row)) { match = cand; break; }
      }
    }
    if (!match) {
      // Fallback: match by name keyword (model designators like E46, W205, MK6)
      const name = row[2] || '';
      const kws = nameKeywords(name);
      for (const kw of kws) {
        const cands = nameIndex.get(kw) || [];
        const free = cands.find(c => !usedSourceRows.has(c.row));
        if (free) { match = free; break; }
      }
    }

    excelRow.height = 80;
    excelRow.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

    let imgs = [];
    if (match && match.images.length > 0) {
      imgs = match.images.slice(0, 2);
      matchedRows++;
      usedSourceRows.add(match.row);
    } else {
      // Fallback: use original EN xlsx single image for this product
      const fallback = enImageBySheetRow.get(`${sheetName}::${r + 1}`) || [];
      if (fallback.length === 0) {
        missingMatch.push({ sheet: sheetName, row: r + 1, name: row[2], oem });
        continue;
      }
      imgs = fallback.slice(0, 2);
    }

    // Embed images into column B (col 2). Each image ~100px wide.
    for (let i = 0; i < imgs.length; i++) {
      const imgPath = path.join(ROOT, imgs[i]);
      if (!fs.existsSync(imgPath)) continue;
      const ext = path.extname(imgPath).slice(1) || 'png';
      const imageId = wbOut.addImage({ filename: imgPath, extension: ext });
      wsOut.addImage(imageId, {
        tl: { col: 1 + i * 0.5, row: r + 0.05 }, // half-cell offsets so both fit in col B
        ext: { width: 95, height: 95 },
        editAs: 'oneCell',
      });
    }
  }
}

(async () => {
  await wbOut.xlsx.writeFile(OUT_XLSX);
  console.log(`\nMatched ${matchedRows}/${totalProductRows} product rows with front+back images.`);
  console.log(`Output: ${OUT_XLSX}`);
  if (missingMatch.length > 0) {
    console.log(`\nUnmatched rows (${missingMatch.length}):`);
    missingMatch.slice(0, 20).forEach(m => console.log(`  ${m.sheet} row${m.row}: ${m.name} (OEM: ${m.oem})`));
    if (missingMatch.length > 20) console.log(`  ...and ${missingMatch.length - 20} more`);
  }
})();

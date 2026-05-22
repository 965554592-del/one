// Count products vs images to determine the missing image
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const xlsxPath = path.join(__dirname, '..', 'Mirror_Lens_Catalog_EN.xlsx');
const wb = XLSX.readFile(xlsxPath, { cellStyles: false, cellFormula: false });

let totalProducts = 0;
const sheetInfo = [];
for (const sn of wb.SheetNames) {
  const ws = wb.Sheets[sn];
  if (!ws['!ref']) continue;
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  // Count product rows: rows where col 0 is a number
  let prodCount = 0;
  for (const row of data) {
    if (typeof row[0] === 'number' && row[0] > 0) prodCount++;
  }
  totalProducts += prodCount;
  sheetInfo.push({ name: sn, rows: data.length, products: prodCount });
}

console.log('Per-sheet product counts:');
sheetInfo.forEach(s => console.log(`  ${s.name}: ${s.products} products (${s.rows} rows total)`));
console.log(`\nTotal products: ${totalProducts}`);
console.log(`Expected images (2 per product): ${totalProducts * 2}`);

const zip = new AdmZip(xlsxPath);
const mediaCount = zip.getEntries().filter(e => e.entryName.startsWith('xl/media/')).length;
console.log(`Actual embedded images: ${mediaCount}`);
console.log(`Difference: expected ${totalProducts * 2} - actual ${mediaCount} = ${totalProducts * 2 - mediaCount}`);

// Sample drawing XML to understand anchor structure
const drawing1 = zip.getEntries().find(e => e.entryName === 'xl/drawings/drawing1.xml');
if (drawing1) {
  console.log('\n=== Sample drawing1.xml first 3000 chars ===');
  console.log(drawing1.getData().toString('utf8').slice(0, 3000));
}

// Inspect per-drawing image references via rels
console.log('\n=== Per-drawing image counts (via _rels) ===');
const rels = zip.getEntries().filter(e => e.entryName.match(/xl\/drawings\/_rels\/drawing\d+\.xml\.rels$/));
for (const r of rels) {
  const xml = r.getData().toString('utf8');
  const imgs = (xml.match(/Target="\.\.\/media\//g) || []).length;
  console.log(`  ${r.entryName}: ${imgs} image refs`);
}

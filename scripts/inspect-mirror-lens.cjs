// Inspect the Mirror_Lens_Catalog_EN.xlsx structure to understand what's there
// and count embedded images to verify the "missing one image" claim.

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const xlsxPath = path.join(__dirname, '..', 'Mirror_Lens_Catalog_EN.xlsx');
const xlsPath = path.join(__dirname, '..', 'jingpian_catalog.xls');

console.log('=== Mirror_Lens_Catalog_EN.xlsx ===');
console.log('Size:', fs.statSync(xlsxPath).size);

const wb = XLSX.readFile(xlsxPath, { cellStyles: false, cellFormula: false });
console.log('Sheet names:', wb.SheetNames);

for (const sn of wb.SheetNames) {
  const ws = wb.Sheets[sn];
  if (!ws['!ref']) continue;
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  console.log(`\n--- Sheet: ${sn} (${data.length} rows) ---`);
  // Show first 5 non-empty rows
  let shown = 0;
  for (let i = 0; i < data.length && shown < 8; i++) {
    const row = data[i];
    if (row.some(c => c !== '')) {
      console.log(`Row ${i}:`, JSON.stringify(row).slice(0, 300));
      shown++;
    }
  }
  console.log(`Range: ${ws['!ref']}, merges: ${(ws['!merges'] || []).length}`);
}

// Extract embedded images count from the xlsx zip
console.log('\n=== Embedded media in xlsx ===');
const zip = new AdmZip(xlsxPath);
const mediaEntries = zip.getEntries().filter(e => e.entryName.startsWith('xl/media/'));
console.log(`Total media files: ${mediaEntries.length}`);
mediaEntries.slice(0, 20).forEach(e => console.log(' -', e.entryName, '(', e.header.size, 'bytes)'));

// Also extract drawing relationships to know per-sheet image counts
const drawingEntries = zip.getEntries().filter(e => e.entryName.match(/xl\/drawings\/drawing\d+\.xml$/));
console.log(`\nDrawings: ${drawingEntries.length}`);
for (const d of drawingEntries) {
  const xml = d.getData().toString('utf8');
  const picCount = (xml.match(/<xdr:pic>/g) || []).length;
  console.log(` - ${d.entryName}: ${picCount} pictures`);
}

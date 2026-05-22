// Inspect the original 镜片目录.xls source to see if it has front+back images
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const xlsPath = path.join(__dirname, '..', 'jingpian_catalog.xls');
console.log('Size:', fs.statSync(xlsPath).size);

// .xls is BIFF (older format) — XLSX library can read it but images won't be available the same way
const wb = XLSX.readFile(xlsPath, { cellStyles: false, cellFormula: false, bookImages: true });
console.log('Sheet names:', wb.SheetNames.slice(0, 30));
console.log('Total sheets:', wb.SheetNames.length);

// Inspect first sheet structure
for (const sn of wb.SheetNames.slice(0, 3)) {
  const ws = wb.Sheets[sn];
  if (!ws['!ref']) continue;
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  console.log(`\n--- Sheet "${sn}" (${data.length} rows, ref ${ws['!ref']}) ---`);
  for (let i = 0; i < Math.min(8, data.length); i++) {
    const row = data[i];
    if (row.some(c => c !== '')) {
      console.log(`Row ${i} [${row.length} cols]:`, JSON.stringify(row).slice(0, 400));
    }
  }
}

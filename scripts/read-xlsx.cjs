const XLSX = require('xlsx');
const path = require('path');

const filePath = 'c:\\Users\\ASUS\\Desktop\\Vida_Auto_Catalog.xlsx';
const wb = XLSX.readFile(filePath, { cellStyles: false, cellFormula: false });

console.log('=== Sheet Names ===');
console.log(wb.SheetNames);

// Read all rows from Audi sheet to understand the data layout
const ws = wb.Sheets['Audi'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1, range: 0, defval: '' });
console.log(`\n=== Sheet: Audi (${data.length} rows) ===`);
for (let i = 0; i < data.length; i++) {
  const row = data[i];
  // Only print rows that have some non-empty content
  const hasContent = row.some(cell => cell !== '');
  if (hasContent) {
    console.log(`Row ${i}:`, JSON.stringify(row));
  }
}

// Also show the cell references to understand merges
const range = XLSX.utils.decode_range(ws['!ref']);
console.log('\nRange:', ws['!ref']);
console.log('Merges:', JSON.stringify(ws['!merges'] || []).slice(0, 500));

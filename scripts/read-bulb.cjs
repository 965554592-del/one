const XLSX = require('xlsx');
const filePath = 'c:\\Users\\ASUS\\Desktop\\Vida_Auto_Bulb_Catalog.xlsx';
const wb = XLSX.readFile(filePath, { cellStyles: false, cellFormula: false });

console.log('=== Sheet Names ===');
console.log(wb.SheetNames);

wb.SheetNames.forEach(name => {
  const ws = wb.Sheets[name];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, range: 0, defval: '' });
  console.log(`\n=== Sheet: ${name} (${data.length} rows) ===`);
  for (let i = 0; i < Math.min(8, data.length); i++) {
    const row = data[i];
    if (row.some(cell => cell !== '')) {
      console.log(`Row ${i}:`, JSON.stringify(row));
    }
  }
});

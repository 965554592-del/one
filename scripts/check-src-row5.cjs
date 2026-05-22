// What's actually in source row 5?
const XLSX = require('xlsx');
const path = require('path');
const wb = XLSX.readFile(path.join(__dirname, '..', 'jingpian_catalog.xls'), { cellStyles: false });
const ws = wb.Sheets['Sheet1'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: true });
console.log('Total source rows:', data.length);
for (let i = 0; i <= 6; i++) {
  console.log(`Source row ${i} (Excel row ${i+1}):`, JSON.stringify(data[i]).slice(0, 250));
}
// Also check raw cell A5/B5/C5
console.log('\nDirect cells:');
console.log('A5:', ws['A5']?.v, 'B5:', ws['B5']?.v, 'C5:', ws['C5']?.v);
console.log('A6:', ws['A6']?.v, 'B6:', ws['B6']?.v, 'C6:', ws['C6']?.v);

/**
 * Import products from Vida_Auto_Catalog.xlsx into Firestore
 * 
 * Structure per sheet:
 * - Row 3: Headers [No., Vehicle, Lens Cover, Model & Year, OEM Part Number, Source Page]
 * - Row 4+: Data rows
 * - Images are embedded (columns B=Vehicle, C=Lens Cover)
 * 
 * Since images are embedded in Excel and cannot be extracted via xlsx library to URLs,
 * we will generate a JSON file with all product data. Images need to be uploaded separately.
 * 
 * Usage: node scripts/import-products.cjs
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const filePath = 'c:\\Users\\ASUS\\Desktop\\Vida_Auto_Catalog.xlsx';
const wb = XLSX.readFile(filePath, { cellStyles: false, cellFormula: false });

const brands = wb.SheetNames.filter(name => name !== 'Cover');
const allProducts = [];

brands.forEach(brand => {
  const ws = wb.Sheets[brand];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, range: 0, defval: '' });
  
  // Skip header rows (rows 0-2), row 3 is column header, data starts from row 4
  for (let i = 4; i < data.length; i++) {
    const row = data[i];
    if (!row[0] && !row[3]) continue; // skip empty rows
    
    const no = row[0];
    const modelYear = (row[3] || '').toString().trim();
    const oemNumber = (row[4] || '').toString().trim();
    
    if (!modelYear) continue;
    
    // Generate SKU from brand + model
    const skuBase = brand.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
    const modelClean = modelYear.replace(/[^A-Za-z0-9]/g, '').slice(0, 8);
    const sku = `HL-${skuBase}-${modelClean}-${String(no).padStart(3, '0')}`;
    
    allProducts.push({
      brand,
      sku,
      name: `${brand} ${modelYear} Headlight Lens Cover`,
      categoryName: '汽车大灯罩',
      modelYear,
      oemNumber,
      price: 0,
      imageIndex: i - 4, // for mapping images later
    });
  }
});

console.log(`Total products: ${allProducts.length}`);
console.log(`Brands: ${brands.join(', ')}`);
console.log('\nSample:');
allProducts.slice(0, 5).forEach(p => console.log(`  ${p.sku} | ${p.name} | OEM: ${p.oemNumber}`));

// Save to JSON for import
const outPath = path.join(__dirname, 'products-data.json');
fs.writeFileSync(outPath, JSON.stringify(allProducts, null, 2), 'utf-8');
console.log(`\nSaved ${allProducts.length} products to ${outPath}`);

// Also extract images from xlsx zip
const AdmZip = require('adm-zip');
const imgDir = path.join(__dirname, 'product-images');
if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });

try {
  const zip = new AdmZip(filePath);
  const entries = zip.getEntries();
  let imgCount = 0;
  entries.forEach(entry => {
    if (entry.entryName.startsWith('xl/media/image') && entry.entryName.endsWith('.png')) {
      const imgName = path.basename(entry.entryName);
      zip.extractEntryTo(entry, imgDir, false, true);
      imgCount++;
    }
  });
  console.log(`\nExtracted ${imgCount} images to ${imgDir}`);
} catch(e) {
  console.log('\nNote: Install adm-zip to extract images: npm install adm-zip');
  console.log('Error:', e.message);
}

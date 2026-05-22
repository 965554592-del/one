/**
 * Extract products with correctly mapped images from xlsx
 * Each sheet's drawing XML has oneCellAnchor with row/col info
 * Pattern: rId1=logo(row0), then pairs: col1=vehicle, col2=lensCover per product row
 */
const XLSX = require('xlsx');
const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

const filePath = 'c:\\Users\\ASUS\\Desktop\\Vida_Auto_Catalog.xlsx';
const zip = new AdmZip(filePath);
const wb = XLSX.readFile(filePath);

const brands = wb.SheetNames.filter(name => name !== 'Cover');
const outDir = path.join(__dirname, 'mapped-images');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const allProducts = [];

brands.forEach((brand, sheetIdx) => {
  const drawingIdx = sheetIdx + 2; // Cover is drawing1, first brand is drawing2
  const relsPath = `xl/drawings/_rels/drawing${drawingIdx}.xml.rels`;
  const drawingPath = `xl/drawings/drawing${drawingIdx}.xml`;

  const relsEntry = zip.getEntries().find(e => e.entryName === relsPath);
  const drawingEntry = zip.getEntries().find(e => e.entryName === drawingPath);

  if (!relsEntry || !drawingEntry) {
    console.log(`  Skipping ${brand}: no drawing data`);
    return;
  }

  // Parse rels to get rId -> image file mapping
  const relsXml = relsEntry.getData().toString('utf-8');
  const rIdToImage = {};
  const relRegex = /<Relationship[^>]+\/>/g;
  let match;
  while ((match = relRegex.exec(relsXml)) !== null) {
    const tag = match[0];
    const idMatch = tag.match(/Id="(rId\d+)"/);
    const targetMatch = tag.match(/Target="([^"]+)"/);
    if (idMatch && targetMatch) {
      const rId = idMatch[1];
      const target = targetMatch[1].replace(/^.*\/media\//, '');
      rIdToImage[rId] = target;
    }
  }

  // Parse drawing XML to get row -> [rId] mapping
  const drawingXml = drawingEntry.getData().toString('utf-8');
  // Split by oneCellAnchor
  const anchors = drawingXml.split('<oneCellAnchor>').slice(1);
  
  const rowImages = {}; // row -> { col1: imageFile, col2: imageFile }
  if (brand === 'Audi') {
    console.log(`  DEBUG rIdToImage keys:`, Object.keys(rIdToImage).slice(0, 5));
    console.log(`  DEBUG relsXml sample:`, relsXml.slice(0, 400));
    console.log(`  DEBUG: ${anchors.length} anchors found`);
    if (anchors[1]) console.log(`  DEBUG anchor[1] first 200:`, anchors[1].slice(0, 200));
  }
  anchors.forEach((anchor, aIdx) => {
    const colMatch = anchor.match(/<col>(\d+)<\/col>/);
    const rowMatch = anchor.match(/<row>(\d+)<\/row>/);
    const rIdMatch = anchor.match(/r:embed="(rId\d+)"/);
    
    if (brand === 'Audi' && aIdx < 3) {
      console.log(`  DEBUG anchor[${aIdx}]: col=${colMatch?.[1]} row=${rowMatch?.[1]} rId=${rIdMatch?.[1]}`);
    }
    
    if (!colMatch || !rowMatch || !rIdMatch) return;
    
    const col = parseInt(colMatch[1]);
    const row = parseInt(rowMatch[1]);
    const rId = rIdMatch[1];
    const imageFile = rIdToImage[rId];
    
    if (row < 4 || !imageFile) return;
    if (!rowImages[row]) rowImages[row] = {};
    if (col === 1) rowImages[row].vehicle = imageFile;
    if (col === 2) rowImages[row].lensCover = imageFile;
  });

  // Read product data
  const ws = wb.Sheets[brand];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, range: 0, defval: '' });

  for (let i = 4; i < data.length; i++) {
    const row = data[i];
    const no = row[0];
    const modelYear = (row[3] || '').toString().trim();
    const oemNumber = (row[4] || '').toString().trim();
    
    if (!modelYear) continue;

    const skuBase = brand.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
    const modelClean = modelYear.replace(/[^A-Za-z0-9]/g, '').slice(0, 8);
    const sku = `HL-${skuBase}-${modelClean}-${String(no).padStart(3, '0')}`;

    const images = rowImages[i] || {};
    const imageFiles = [];
    if (images.vehicle) imageFiles.push(images.vehicle);
    if (images.lensCover) imageFiles.push(images.lensCover);

    // Copy and rename images
    const renamedImages = [];
    imageFiles.forEach((imgFile, idx) => {
      const srcEntry = zip.getEntries().find(e => e.entryName === `xl/media/${imgFile}`);
      if (srcEntry) {
        const ext = path.extname(imgFile);
        const newName = `${sku}_${idx + 1}${ext}`;
        const destPath = path.join(outDir, newName);
        fs.writeFileSync(destPath, srcEntry.getData());
        renamedImages.push(newName);
      }
    });

    allProducts.push({
      brand,
      sku,
      name: `${brand} ${modelYear} Headlight Lens Cover`,
      categoryName: '汽车大灯罩',
      modelYear,
      oemNumber,
      price: 0,
      imageFiles: renamedImages,
    });
  }

  console.log(`  ${brand}: ${Object.keys(rowImages).length} image rows mapped`);
});

console.log(`\nTotal: ${allProducts.length} products`);
console.log(`Products with images: ${allProducts.filter(p => p.imageFiles.length > 0).length}`);
console.log(`Products without images: ${allProducts.filter(p => p.imageFiles.length === 0).length}`);

// Save final data
const jsonPath = path.join(__dirname, 'products-final.json');
fs.writeFileSync(jsonPath, JSON.stringify(allProducts, null, 2), 'utf-8');
console.log(`\nSaved to ${jsonPath}`);
console.log(`Images in: ${outDir}`);

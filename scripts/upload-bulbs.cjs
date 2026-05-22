/**
 * Extract and upload bulb products from Vida_Auto_Bulb_Catalog.xlsx
 */
const XLSX = require('xlsx');
const AdmZip = require('adm-zip');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const filePath = 'c:\\Users\\ASUS\\Desktop\\Vida_Auto_Bulb_Catalog.xlsx';
const zip = new AdmZip(filePath);
const wb = XLSX.readFile(filePath);

// Init Firebase Admin
const serviceAccount = require('c:/Users/ASUS/Downloads/gen-lang-client-0915949910-firebase-adminsdk-fbsvc-e9858b8e4e.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'gen-lang-client-0915949910.firebasestorage.app'
});
const db = admin.firestore();
db.settings({ databaseId: 'ai-studio-3112dc56-9c5d-41d4-8544-f79c07c29140' });
const bucket = admin.storage().bucket();

const BATCH_SIZE = 5;
const DELAY_MS = 500;
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('Starting bulb import...');

  // Find or verify category "灯泡"
  const catsSnap = await db.collection('categories').orderBy('order', 'asc').get();
  const existingCats = catsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  let bulbCat = existingCats.find(c => c.name === '灯泡');
  if (!bulbCat) {
    console.log('Creating category: 灯泡');
    const catRef = await db.collection('categories').add({
      name: '灯泡',
      description: 'Auto Bulbs - HID, Halogen, LED',
      order: existingCats.length,
      createdAt: new Date().toISOString()
    });
    bulbCat = { id: catRef.id, name: '灯泡' };
  }
  console.log(`Category: ${bulbCat.name} (${bulbCat.id})`);

  const brands = wb.SheetNames.filter(name => name !== 'Cover');
  const allProducts = [];

  brands.forEach((sheetName, sheetIdx) => {
    const drawingIdx = sheetIdx + 2; // Cover is drawing1
    const relsPath = `xl/drawings/_rels/drawing${drawingIdx}.xml.rels`;
    const drawingPath = `xl/drawings/drawing${drawingIdx}.xml`;

    const relsEntry = zip.getEntries().find(e => e.entryName === relsPath);
    const drawingEntry = zip.getEntries().find(e => e.entryName === drawingPath);

    // Parse rels
    const rIdToImage = {};
    if (relsEntry) {
      const relsXml = relsEntry.getData().toString('utf-8');
      const relRegex = /<Relationship[^>]+\/>/g;
      let match;
      while ((match = relRegex.exec(relsXml)) !== null) {
        const tag = match[0];
        const idMatch = tag.match(/Id="(rId\d+)"/);
        const targetMatch = tag.match(/Target="([^"]+)"/);
        if (idMatch && targetMatch) {
          rIdToImage[idMatch[1]] = targetMatch[1].replace(/^.*\/media\//, '');
        }
      }
    }

    // Parse drawing XML for image positions
    const rowImages = {};
    if (drawingEntry) {
      const drawingXml = drawingEntry.getData().toString('utf-8');
      const anchors = drawingXml.split('<oneCellAnchor>').slice(1);
      anchors.forEach(anchor => {
        const colMatch = anchor.match(/<col>(\d+)<\/col>/);
        const rowMatch = anchor.match(/<row>(\d+)<\/row>/);
        const rIdMatch = anchor.match(/r:embed="(rId\d+)"/);
        if (!colMatch || !rowMatch || !rIdMatch) return;
        const col = parseInt(colMatch[1]);
        const row = parseInt(rowMatch[1]);
        const imageFile = rIdToImage[rIdMatch[1]];
        if (row >= 4 && col === 1 && imageFile) {
          rowImages[row] = imageFile;
        }
      });
    }

    // Read product data
    const ws = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, range: 0, defval: '' });

    for (let i = 4; i < data.length; i++) {
      const row = data[i];
      const no = row[0];
      const bulbCode = (row[2] || '').toString().trim();
      const voltage = (row[3] || '').toString().trim();
      const category = (row[4] || '').toString().trim();

      if (!bulbCode) continue;

      const codeClean = bulbCode.replace(/[^A-Za-z0-9]/g, '').slice(0, 10);
      const sku = `BLB-${codeClean}-${String(no).padStart(3, '0')}`;

      const imageFile = rowImages[i] || null;

      allProducts.push({
        sku,
        name: `${bulbCode} Auto Bulb`,
        bulbCode,
        voltage,
        subCategory: category,
        imageFile,
      });
    }

    console.log(`  ${sheetName}: ${Object.keys(rowImages).length} images, ${data.length - 4} products`);
  });

  console.log(`\nTotal bulb products: ${allProducts.length}`);
  console.log(`With images: ${allProducts.filter(p => p.imageFile).length}`);

  // Upload
  let uploaded = 0, failed = 0;

  for (let i = 0; i < allProducts.length; i += BATCH_SIZE) {
    const batch = allProducts.slice(i, i + BATCH_SIZE);

    const promises = batch.map(async (product) => {
      try {
        const imageUrls = [];
        if (product.imageFile) {
          const srcEntry = zip.getEntries().find(e => e.entryName === `xl/media/${product.imageFile}`);
          if (srcEntry) {
            const destPath = `products/${product.sku}/${product.imageFile}`;
            const file = bucket.file(destPath);
            await file.save(srcEntry.getData(), { metadata: { contentType: 'image/png' } });
            await file.makePublic();
            imageUrls.push(`https://storage.googleapis.com/${bucket.name}/${destPath}`);
          }
        }

        await db.collection('products').add({
          sku: product.sku,
          name: product.name,
          categoryId: bulbCat.id,
          categoryName: bulbCat.name,
          price: 0,
          oemNumber: product.bulbCode,
          imageUrls,
          techSpecs: {
            compatibility: product.voltage || '',
            material: product.subCategory,
            weight: ''
          },
          brand: product.subCategory,
          createdAt: new Date().toISOString()
        });

        uploaded++;
      } catch (err) {
        failed++;
        console.error(`  FAIL [${product.sku}]: ${err.message}`);
      }
    });

    await Promise.all(promises);
    console.log(`  Progress: ${Math.min(i + BATCH_SIZE, allProducts.length)}/${allProducts.length} (OK: ${uploaded}, FAIL: ${failed})`);
    if (i + BATCH_SIZE < allProducts.length) await sleep(DELAY_MS);
  }

  console.log(`\n✅ Done! Uploaded: ${uploaded}, Failed: ${failed}`);
  process.exit(0);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });

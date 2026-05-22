/**
 * Upload products + images to Firebase using Admin SDK
 * Usage: node scripts/upload-admin.cjs
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Init Admin SDK
const serviceAccount = require('c:/Users/ASUS/Downloads/gen-lang-client-0915949910-firebase-adminsdk-fbsvc-e9858b8e4e.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'gen-lang-client-0915949910.firebasestorage.app'
});

const db = admin.firestore();
db.settings({ databaseId: 'ai-studio-3112dc56-9c5d-41d4-8544-f79c07c29140' });

const bucket = admin.storage().bucket();

const PRODUCTS_JSON = path.join(__dirname, 'products-final.json');
const IMAGES_DIR = path.join(__dirname, 'mapped-images');

const BATCH_SIZE = 5;
const DELAY_MS = 500;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('Starting upload...');

  // Load products
  const products = JSON.parse(fs.readFileSync(PRODUCTS_JSON, 'utf-8'));
  console.log(`Loaded ${products.length} products`);

  // Find or create category
  const catsSnap = await db.collection('categories').orderBy('order', 'asc').get();
  const existingCats = catsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`Existing categories: ${existingCats.map(c => c.name).join(', ')}`);

  let headlightCat = existingCats.find(c => c.name === '汽车大灯罩');
  if (!headlightCat) {
    console.log('Creating category: 汽车大灯罩');
    const catRef = await db.collection('categories').add({
      name: '汽车大灯罩',
      description: 'Headlight Lens Covers for all vehicle brands',
      order: existingCats.length,
      createdAt: new Date().toISOString()
    });
    headlightCat = { id: catRef.id, name: '汽车大灯罩' };
  }
  console.log(`Category ID: ${headlightCat.id}`);

  let uploaded = 0;
  let failed = 0;

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);

    const promises = batch.map(async (product) => {
      try {
        // Upload images
        const imageUrls = [];
        for (const imgFile of product.imageFiles) {
          const imgPath = path.join(IMAGES_DIR, imgFile);
          if (!fs.existsSync(imgPath)) continue;

          const destPath = `products/${product.sku}/${imgFile}`;
          const file = bucket.file(destPath);

          await file.save(fs.readFileSync(imgPath), {
            metadata: { contentType: 'image/png' }
          });
          await file.makePublic();

          const url = `https://storage.googleapis.com/${bucket.name}/${destPath}`;
          imageUrls.push(url);
        }

        // Create Firestore document
        await db.collection('products').add({
          sku: product.sku,
          name: product.name,
          categoryId: headlightCat.id,
          categoryName: headlightCat.name,
          price: 0,
          oemNumber: product.oemNumber || '',
          imageUrls,
          techSpecs: {
            compatibility: product.modelYear,
            material: '',
            weight: ''
          },
          brand: product.brand,
          createdAt: new Date().toISOString()
        });

        uploaded++;
      } catch (err) {
        failed++;
        console.error(`  FAIL [${product.sku}]: ${err.message}`);
      }
    });

    await Promise.all(promises);
    console.log(`  Progress: ${Math.min(i + BATCH_SIZE, products.length)}/${products.length} (OK: ${uploaded}, FAIL: ${failed})`);

    if (i + BATCH_SIZE < products.length) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`\n✅ Done! Uploaded: ${uploaded}, Failed: ${failed}`);
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});

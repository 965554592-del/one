/**
 * Upload products + images to Firebase
 * 
 * This script uses Firebase client SDK with admin email/password login.
 * 
 * Prerequisites:
 *   1. Set environment variables:
 *      FIREBASE_ADMIN_EMAIL=your-admin@email.com
 *      FIREBASE_ADMIN_PASSWORD=your-password
 *   
 *   Or create a .env file in scripts/ folder.
 *
 * Usage: node scripts/upload-to-firebase.cjs
 */

const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, collection, addDoc, getDocs, query, orderBy } = require('firebase/firestore');
const { getStorage, ref, uploadBytes, getDownloadURL } = require('firebase/storage');
const fs = require('fs');
const path = require('path');

// Load firebase config
const firebaseConfig = require('../firebase-applet-config.json');

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const storage = getStorage(app);

const PRODUCTS_JSON = path.join(__dirname, 'products-final.json');
const IMAGES_DIR = path.join(__dirname, 'mapped-images');

// Batch size to avoid rate limits
const BATCH_SIZE = 10;
const DELAY_MS = 1000;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  // Get credentials from args or env
  const email = process.env.FIREBASE_ADMIN_EMAIL || process.argv[2];
  const password = process.env.FIREBASE_ADMIN_PASSWORD || process.argv[3];

  if (!email || !password) {
    console.error('Usage: node upload-to-firebase.cjs <admin-email> <admin-password>');
    process.exit(1);
  }

  console.log('Signing in...');
  await signInWithEmailAndPassword(auth, email, password);
  console.log('Logged in as:', auth.currentUser.email);

  // Load products
  const products = JSON.parse(fs.readFileSync(PRODUCTS_JSON, 'utf-8'));
  console.log(`Loaded ${products.length} products`);

  // Fetch existing categories to find/create the headlight category
  const catsSnap = await getDocs(query(collection(db, 'categories'), orderBy('order', 'asc')));
  const existingCats = catsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`Existing categories: ${existingCats.map(c => c.name).join(', ')}`);

  let headlightCat = existingCats.find(c => c.name === '汽车大灯罩');
  if (!headlightCat) {
    console.log('Creating category: 汽车大灯罩');
    const catRef = await addDoc(collection(db, 'categories'), {
      name: '汽车大灯罩',
      description: 'Headlight Lens Covers for all vehicle brands',
      order: existingCats.length,
      createdAt: new Date().toISOString()
    });
    headlightCat = { id: catRef.id, name: '汽车大灯罩' };
  }
  console.log(`Category ID: ${headlightCat.id}`);

  // Upload products in batches
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
          
          const fileBuffer = fs.readFileSync(imgPath);
          const storagePath = `products/${product.sku}/${imgFile}`;
          const storageRef = ref(storage, storagePath);
          
          await uploadBytes(storageRef, fileBuffer, { contentType: 'image/png' });
          const url = await getDownloadURL(storageRef);
          imageUrls.push(url);
        }

        // Create Firestore document
        await addDoc(collection(db, 'products'), {
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
    console.log(`  Progress: ${Math.min(i + BATCH_SIZE, products.length)}/${products.length} (uploaded: ${uploaded}, failed: ${failed})`);
    
    if (i + BATCH_SIZE < products.length) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`\nDone! Uploaded: ${uploaded}, Failed: ${failed}`);
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

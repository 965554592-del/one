/**
 * One-time fix: sync all products' categoryName with their category's current name
 */
const admin = require('firebase-admin');
const serviceAccount = require('c:/Users/ASUS/Downloads/gen-lang-client-0915949910-firebase-adminsdk-fbsvc-e9858b8e4e.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();
db.settings({ databaseId: 'ai-studio-3112dc56-9c5d-41d4-8544-f79c07c29140' });

async function main() {
  // Load all categories
  const catsSnap = await db.collection('categories').get();
  const catMap = {};
  catsSnap.docs.forEach(d => { catMap[d.id] = d.data().name; });
  console.log('Categories:', catMap);

  // Load all products
  const prodsSnap = await db.collection('products').get();
  console.log(`Total products: ${prodsSnap.size}`);

  let fixed = 0;
  const batchSize = 500;
  let batch = db.batch();
  let count = 0;

  for (const prodDoc of prodsSnap.docs) {
    const data = prodDoc.data();
    const correctName = catMap[data.categoryId];
    if (correctName && data.categoryName !== correctName) {
      batch.update(prodDoc.ref, { categoryName: correctName });
      fixed++;
      count++;
      if (count >= batchSize) {
        await batch.commit();
        batch = db.batch();
        count = 0;
        console.log(`  Committed batch, fixed so far: ${fixed}`);
      }
    }
  }

  if (count > 0) {
    await batch.commit();
  }

  console.log(`\n✅ Fixed ${fixed} products' categoryName`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });

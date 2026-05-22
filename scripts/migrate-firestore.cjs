/**
 * Migrate all Firestore data from the AI Studio free-tier database
 * to the new (default) database in the same Firebase project.
 *
 * Both DBs share the same project + service account, so a single Admin
 * SDK app can talk to both via initializeFirestore({ databaseId }).
 *
 * Usage:
 *   node scripts/migrate-firestore.cjs              # full migration
 *   node scripts/migrate-firestore.cjs --dry-run    # list collections + counts only
 *   node scripts/migrate-firestore.cjs users        # migrate one collection
 */
const admin = require('firebase-admin');
const { Firestore } = require('@google-cloud/firestore');

const SOURCE_DB = 'ai-studio-3112dc56-9c5d-41d4-8544-f79c07c29140';
const TARGET_DB = 'vida-prod';
const DRY_RUN = process.argv.includes('--dry-run');
const ONLY = process.argv.find(a => !a.startsWith('--') && !a.endsWith('.cjs') && !a.includes('node'));

const serviceAccount = require('c:/Users/ASUS/Downloads/gen-lang-client-0915949910-firebase-adminsdk-fbsvc-e9858b8e4e.json');

// Two Firestore clients pointing at different databases in the same project.
const sourceDb = new Firestore({
  projectId: serviceAccount.project_id,
  credentials: { client_email: serviceAccount.client_email, private_key: serviceAccount.private_key },
  databaseId: SOURCE_DB,
});
const targetDb = new Firestore({
  projectId: serviceAccount.project_id,
  credentials: { client_email: serviceAccount.client_email, private_key: serviceAccount.private_key },
  databaseId: TARGET_DB,
});

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** Recursively copy a doc + all its subcollections. */
async function copyDoc(srcRef, dstRef) {
  const snap = await srcRef.get();
  if (snap.exists) {
    await dstRef.set(snap.data(), { merge: false });
  }
  const subcols = await srcRef.listCollections();
  for (const sub of subcols) {
    await copyCollection(sub, dstRef.collection(sub.id));
  }
}

/** Copy every doc in a top-level or subcollection, batched at 400/req. */
async function copyCollection(srcCol, dstCol) {
  // Use .get() instead of listDocuments() because Firestore Enterprise Edition
  // does not support the show_missing flag that listDocuments relies on.
  const snap = await srcCol.get();
  const docs = snap.docs;
  console.log(`  Found ${docs.length} docs in ${srcCol.path}`);

  let written = 0;
  for (let i = 0; i < docs.length; i += 400) {
    const slice = docs.slice(i, i + 400);
    if (!DRY_RUN) {
      const batch = targetDb.batch();
      for (const docSnap of slice) {
        batch.set(dstCol.doc(docSnap.id), docSnap.data());
      }
      await batch.commit();
    }
    written += slice.length;
    process.stdout.write(`\r  ${dstCol.path}: ${written}/${docs.length}`);
  }
  if (docs.length > 0) process.stdout.write('\n');

  // Recursively copy subcollections after parent docs are written.
  for (const docSnap of docs) {
    try {
      const subs = await srcCol.doc(docSnap.id).listCollections();
      for (const sub of subs) {
        await copyCollection(sub, dstCol.doc(docSnap.id).collection(sub.id));
      }
    } catch (err) {
      // listCollections may also be limited on Enterprise Edition; ignore if so.
      if (!String(err.message || '').includes('Enterprise')) throw err;
    }
  }
  return docs.length;
}

async function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY-RUN' : 'LIVE'}`);
  console.log(`Source: ${SOURCE_DB}`);
  console.log(`Target: ${TARGET_DB}`);
  if (ONLY) console.log(`Only collection: ${ONLY}`);
  console.log('');

  const topCols = await sourceDb.listCollections();
  console.log(`Found ${topCols.length} top-level collections in source:`);
  for (const c of topCols) console.log(`  - ${c.id}`);
  console.log('');

  let total = 0;
  for (const col of topCols) {
    if (ONLY && col.id !== ONLY) continue;
    console.log(`\n>>> Migrating: ${col.id}`);
    const count = await copyCollection(col, targetDb.collection(col.id));
    total += count;
    if (!DRY_RUN) await sleep(500); // gentle pacing between collections
  }

  console.log(`\n${DRY_RUN ? '[Dry-run]' : '[Done]'} Migrated ~${total} top-level documents (subcollections copied recursively).`);
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});

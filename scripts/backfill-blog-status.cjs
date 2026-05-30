/**
 * Backfill missing `status` field on existing blogPosts documents.
 * Any document that has no `status` field will be updated to status="published".
 *
 * Usage:
 *   node scripts/backfill-blog-status.cjs            # live update
 *   node scripts/backfill-blog-status.cjs --dry-run  # preview only, no writes
 */
const { Firestore } = require('@google-cloud/firestore');

const TARGET_DB  = 'vida-prod';
const DRY_RUN    = process.argv.includes('--dry-run');

const fs   = require('fs');
const path = require('path');

// Try project-local service account first, then Downloads fallback
const LOCAL_SA   = path.join(__dirname, 'service-account.json');
const DOWNLOAD_SA = 'c:/Users/ASUS/Downloads/gen-lang-client-0915949910-firebase-adminsdk-fbsvc-39e83fd623.json';
const SA_PATH    = fs.existsSync(LOCAL_SA) ? LOCAL_SA : DOWNLOAD_SA;
const serviceAccount = require(SA_PATH);
console.log(`Service account: ${SA_PATH}`);

const db = new Firestore({
  projectId: serviceAccount.project_id,
  credentials: {
    client_email: serviceAccount.client_email,
    private_key:  serviceAccount.private_key,
  },
  databaseId: TARGET_DB,
});

async function main() {
  console.log(`Mode    : ${DRY_RUN ? 'DRY-RUN (no writes)' : 'LIVE'}`);
  console.log(`Database: ${TARGET_DB}`);
  console.log(`Task    : add status="published" to blogPosts docs without a status field\n`);

  const snap = await db.collection('blogPosts').get();
  console.log(`Total blogPosts documents: ${snap.size}`);

  const missing = snap.docs.filter(d => d.data().status === undefined);
  console.log(`Docs missing status field : ${missing.length}`);

  if (missing.length === 0) {
    console.log('\nAll documents already have a status field. Nothing to do.');
    process.exit(0);
  }

  if (DRY_RUN) {
    console.log('\nDry-run preview — would update:');
    missing.forEach(d => console.log(`  - ${d.id}  title="${d.data().title || '(no title)'}"`));
    console.log('\nRe-run without --dry-run to apply changes.');
    process.exit(0);
  }

  // Firestore batches are limited to 500 ops each
  const BATCH_SIZE = 400;
  let updated = 0;

  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const slice = missing.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const docSnap of slice) {
      batch.update(db.collection('blogPosts').doc(docSnap.id), { status: 'published' });
    }
    await batch.commit();
    updated += slice.length;
    console.log(`  Updated ${updated}/${missing.length}`);
  }

  console.log(`\n✓ Done — set status="published" on ${updated} document(s).`);
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});

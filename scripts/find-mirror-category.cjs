const admin = require('firebase-admin');
const serviceAccount = require('c:/Users/ASUS/Downloads/gen-lang-client-0915949910-firebase-adminsdk-fbsvc-e9858b8e4e.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
db.settings({ databaseId: 'ai-studio-3112dc56-9c5d-41d4-8544-f79c07c29140' });

(async () => {
  const snap = await db.collection('categories').orderBy('order', 'asc').get();
  console.log(`Total categories: ${snap.size}`);
  snap.docs.forEach(d => {
    const c = d.data();
    console.log(`  ${d.id} | order:${c.order} | name:"${c.name}" | parent:${c.parentId || '-'} | desc:${(c.description || '').slice(0,60)}`);
  });
  process.exit(0);
})();

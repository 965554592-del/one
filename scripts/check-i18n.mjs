import fs from 'fs';

const en = fs.readFileSync('src/i18n.ts', 'utf8');
const zh = fs.readFileSync('src/locales/zh.ts', 'utf8');

const extractKeys = (src) => [...src.matchAll(/"([a-z][a-z0-9_.]+)":/g)].map(m => m[1]);

const enKeys = extractKeys(en);
const zhKeys = extractKeys(zh);

const missingInZh = enKeys.filter(k => !zhKeys.includes(k));
const missingInEn = zhKeys.filter(k => !enKeys.includes(k));

console.log(`EN keys: ${enKeys.length}, ZH keys: ${zhKeys.length}`);
console.log(`\n=== Missing in ZH (${missingInZh.length}) ===`);
missingInZh.forEach(k => console.log(`  "${k}"`));
console.log(`\n=== Missing in EN (${missingInEn.length}) ===`);
missingInEn.forEach(k => console.log(`  "${k}"`));

// Also find t() calls with fallback values (keys used in code but maybe not in i18n)
const codeFiles = [
  'src/pages/AdminDashboard.tsx',
  'src/pages/Home.tsx',
  'src/pages/Factory.tsx',
  'src/pages/Products.tsx',
  'src/components/Footer.tsx',
];

const codeKeys = new Set();
for (const f of codeFiles) {
  try {
    const src = fs.readFileSync(f, 'utf8');
    const matches = [...src.matchAll(/t\(['"]([a-z][a-z0-9_.]+)['"]/g)];
    matches.forEach(m => codeKeys.add(m[1]));
  } catch {}
}

const usedButMissing = [...codeKeys].filter(k => !enKeys.includes(k));
if (usedButMissing.length) {
  console.log(`\n=== Used in code but missing from EN i18n (${usedButMissing.length}) ===`);
  usedButMissing.forEach(k => console.log(`  "${k}"`));
}

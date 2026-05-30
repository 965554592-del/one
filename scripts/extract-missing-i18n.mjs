import fs from 'fs';
import path from 'path';

// Recursively find all .tsx/.ts files in src/
function walkSync(dir, ext, results = []) {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) walkSync(full, ext, results);
    else if (ext.some(e => f.endsWith(e))) results.push(full);
  }
  return results;
}

const files = walkSync('src', ['.tsx', '.ts']);
const enSrc = fs.readFileSync('src/i18n.ts', 'utf8');
const existingKeys = new Set([...enSrc.matchAll(/"([a-z][a-z0-9_.]+)":/g)].map(m => m[1]));

// Match t('key', 'fallback') patterns
const missing = new Map();
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  // Pattern: t('key', 'fallback') or t("key", "fallback")
  const re = /t\(['"]([a-z][a-z0-9_.]+)['"](?:\s*,\s*['"]([^'"]+)['"])?\)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const [, key, fallback] = m;
    if (!existingKeys.has(key) && !missing.has(key)) {
      missing.set(key, { fallback: fallback || key, file: path.relative('.', f) });
    }
  }
}

// Sort and output
const sorted = [...missing.entries()].sort((a, b) => a[0].localeCompare(b[0]));
console.log(`Missing keys with fallbacks (${sorted.length}):\n`);

// Group by prefix
const groups = {};
for (const [key, { fallback, file }] of sorted) {
  const prefix = key.split('.')[0];
  if (!groups[prefix]) groups[prefix] = [];
  groups[prefix].push({ key, fallback, file });
}

for (const [prefix, items] of Object.entries(groups)) {
  console.log(`\n// --- ${prefix} ---`);
  for (const { key, fallback, file } of items) {
    console.log(`"${key}": "${fallback}",  // ${file}`);
  }
}

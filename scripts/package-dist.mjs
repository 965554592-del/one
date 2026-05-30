import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

if (!fs.existsSync(distDir)) {
  console.error('Error: dist directory does not exist. Run build first.');
  process.exit(1);
}

// Generate timestamp: YYYYMMDD-HHMM
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;

const zipFiles = [
  path.join(rootDir, 'dist-flat.zip'),
  path.join(rootDir, 'dist-LATEST.zip'),
  path.join(rootDir, `dist-${timestamp}.zip`)
];

console.log(`Zipping ${distDir} to:`);
zipFiles.forEach(f => console.log(` - ${path.basename(f)}`));

try {
  const zip = new AdmZip();
  zip.addLocalFolder(distDir);
  
  zipFiles.forEach(zipPath => {
    zip.writeZip(zipPath);
    console.log(`✓ Successfully created ${path.basename(zipPath)}`);
  });
} catch (error) {
  console.error('Failed to create zip packages:', error);
  process.exit(1);
}

// Extract images from Mirror_Lens_Catalog_EN.xlsx (the original), mapping each
// image to its sheet+anchor row by parsing drawing XML.

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const SRC = path.join(__dirname, '..', 'Mirror_Lens_Catalog_EN.xlsx');
const OUT_DIR = path.join(__dirname, '..', 'en-extracted-images');
if (fs.existsSync(OUT_DIR)) fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const zip = new AdmZip(SRC);

// Map sheet name -> drawing path by parsing workbook.xml.rels and sheet rels.
// Simpler: iterate drawing files, parse each for image references with anchor rows.
// Then map drawing N to sheet N via the workbook xml order.

const wbXml = zip.readAsText('xl/workbook.xml');
const sheetMatches = [...wbXml.matchAll(/<sheet\s[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)];
console.log(`Found ${sheetMatches.length} sheets in workbook.xml`);
const wbRelsXml = zip.readAsText('xl/_rels/workbook.xml.rels');
const ridToTarget = {};
[...wbRelsXml.matchAll(/<Relationship\s[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)].forEach(m => {
  ridToTarget[m[1]] = m[2];
});
[...wbRelsXml.matchAll(/<Relationship\s[^>]*Target="([^"]+)"[^>]*Id="([^"]+)"/g)].forEach(m => {
  ridToTarget[m[2]] = m[1];
});

// For each sheet, find its drawing via sheet rels
const sheetToDrawing = {};
for (const m of sheetMatches) {
  const sheetName = m[1];
  const sheetRid = m[2];
  let sheetTarget = ridToTarget[sheetRid]; // e.g. "/xl/worksheets/sheet1.xml" or "worksheets/sheet1.xml"
  if (!sheetTarget) continue;
  // Normalize to inside zip path
  sheetTarget = sheetTarget.replace(/^\/?xl\//, '').replace(/^\//, '');
  const sheetRelsPath = `xl/${sheetTarget.replace(/([^/]+)\.xml$/, '_rels/$1.xml.rels')}`;
  if (!zip.getEntry(sheetRelsPath)) {
    console.log(`[skip] no rels file for ${sheetName} at ${sheetRelsPath}`);
    continue;
  }
  const relsXml = zip.readAsText(sheetRelsPath);
  const drawingMatch = relsXml.match(/Target="([^"]*drawings\/drawing\d+\.xml)"/);
  if (drawingMatch) {
    let dt = drawingMatch[1];
    if (dt.startsWith('../')) dt = `xl/${dt.replace(/^\.\.\//, '')}`;
    else if (dt.startsWith('/')) dt = dt.replace(/^\//, '');
    else dt = `xl/${dt}`;
    sheetToDrawing[sheetName] = dt;
  }
}

console.log(`Found ${Object.keys(sheetToDrawing).length} sheets with drawings`);
const meta = []; // { sheet, row, image }
let firstLog = true;
for (const [sheetName, drawingPath] of Object.entries(sheetToDrawing)) {
  if (firstLog) {
    console.log(`First sheet: ${sheetName} drawing: ${drawingPath}`);
    firstLog = false;
  }
  if (!zip.getEntry(drawingPath)) {
    console.log(`[skip] drawing not found: ${drawingPath}`);
    continue;
  }
  const drawingXml = zip.readAsText(drawingPath);
  const drawingRelsPath = drawingPath.replace(/([^/]+)\.xml$/, '_rels/$1.xml.rels');
  const drawingRelsXml = zip.readAsText(drawingRelsPath);
  const ridToMedia = {};
  [...drawingRelsXml.matchAll(/<Relationship\s[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)].forEach(m => {
    ridToMedia[m[1]] = m[2];
  });
  [...drawingRelsXml.matchAll(/<Relationship\s[^>]*Target="([^"]+)"[^>]*Id="([^"]+)"/g)].forEach(m => {
    ridToMedia[m[2]] = m[1];
  });

  // Match each picture's anchor row + rId
  // Format: <oneCellAnchor><from>...<row>R</row>...</from>...<a:blip r:embed="rIdX" /></...>
  const anchorRe = /<(?:oneCellAnchor|twoCellAnchor)>([\s\S]*?)<\/(?:oneCellAnchor|twoCellAnchor)>/g;
  let am;
  while ((am = anchorRe.exec(drawingXml)) !== null) {
    const block = am[1];
    const rowMatch = block.match(/<from>[\s\S]*?<row>(\d+)<\/row>/);
    const embedMatch = block.match(/r:embed="([^"]+)"/);
    if (!rowMatch || !embedMatch) continue;
    const row = parseInt(rowMatch[1], 10); // 0-indexed in xlsx drawing XML
    const rid = embedMatch[1];
    const mediaTarget = ridToMedia[rid]; // "../media/imageN.png" or "/xl/media/imageN.png"
    if (!mediaTarget) continue;
    let zipMediaPath = mediaTarget;
    if (zipMediaPath.startsWith('../')) zipMediaPath = `xl/${zipMediaPath.replace(/^\.\.\//, '')}`;
    else if (zipMediaPath.startsWith('/')) zipMediaPath = zipMediaPath.replace(/^\//, '');
    const ext = path.extname(zipMediaPath) || '.png';
    const outName = `${sheetName.replace(/[^A-Za-z0-9_-]/g, '_')}_r${row + 1}${ext}`;
    const outPath = path.join(OUT_DIR, outName);
    const entry = zip.getEntry(zipMediaPath);
    if (entry && !fs.existsSync(outPath)) {
      fs.writeFileSync(outPath, entry.getData());
    }
    meta.push({ sheet: sheetName, row: row + 1, image: `en-extracted-images/${outName}` });
  }
}

fs.writeFileSync(path.join(__dirname, '..', 'en-extracted-images-meta.json'), JSON.stringify(meta, null, 2));
console.log(`Extracted ${meta.length} images from EN xlsx. Meta written.`);

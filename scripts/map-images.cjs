/**
 * Map images to products by analyzing the drawing relationships in the xlsx
 */
const XLSX = require('xlsx');
const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

const filePath = 'c:\\Users\\ASUS\\Desktop\\Vida_Auto_Catalog.xlsx';
const zip = new AdmZip(filePath);

// Read the drawing rels to understand image-to-sheet mapping
const entries = zip.getEntries();
const drawingEntries = entries.filter(e => e.entryName.includes('drawing') && e.entryName.endsWith('.xml'));

console.log('Drawing files:');
drawingEntries.forEach(e => console.log(' ', e.entryName, e.header.size));

// Check sheet1 drawing rels (Audi is sheet2)
const sheet2DrawingRel = entries.find(e => e.entryName === 'xl/worksheets/_rels/sheet2.xml.rels');
if (sheet2DrawingRel) {
  console.log('\n=== Sheet2 (Audi) rels ===');
  console.log(sheet2DrawingRel.getData().toString('utf-8'));
}

// Read a drawing xml to understand anchors
const drawing2 = entries.find(e => e.entryName === 'xl/drawings/drawing2.xml');
if (drawing2) {
  const content = drawing2.getData().toString('utf-8');
  // Just show first 3000 chars to understand structure
  console.log('\n=== Drawing2 (first 3000 chars) ===');
  console.log(content.slice(0, 3000));
}

// Count images per drawing
const drawingRels = entries.filter(e => e.entryName.includes('drawings/_rels'));
console.log('\n=== Image counts per drawing ===');
drawingRels.forEach(e => {
  const content = e.getData().toString('utf-8');
  const imgCount = (content.match(/image/g) || []).length;
  console.log(`  ${e.entryName}: ${imgCount} images`);
});

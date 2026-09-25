import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createCanvas } from '@napi-rs/canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const inputs = process.argv.slice(2);
const outputDir = path.resolve('tmp/pdf-review/output');
fs.mkdirSync(outputDir, { recursive: true });

for (let fileIndex = 0; fileIndex < inputs.length; fileIndex += 1) {
  const input = path.resolve(inputs[fileIndex]);
  const pdf = await getDocument({ url: pathToFileURL(input).href }).promise;
  const textPages = [];
  console.log(`FILE ${fileIndex + 1}: ${input}`);
  console.log(`PAGES: ${pdf.numPages}`);

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const lines = [];
    let currentY = null;
    let currentLine = [];
    for (const item of content.items) {
      if (!('str' in item)) continue;
      const y = Math.round(item.transform[5]);
      if (currentY !== null && Math.abs(y - currentY) > 3) {
        lines.push(currentLine.join(' ').replace(/\s+/g, ' ').trim());
        currentLine = [];
      }
      currentY = y;
      if (item.str.trim()) currentLine.push(item.str.trim());
    }
    if (currentLine.length) lines.push(currentLine.join(' ').replace(/\s+/g, ' ').trim());
    textPages.push(`\n===== PAGE ${pageNumber} =====\n${lines.join('\n')}`);

    const viewport = page.getViewport({ scale: 1.6 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    fs.writeFileSync(path.join(outputDir, `pdf${fileIndex + 1}-page-${pageNumber}.png`), canvas.toBuffer('image/png'));
  }

  const textPath = path.join(outputDir, `pdf${fileIndex + 1}.txt`);
  fs.writeFileSync(textPath, textPages.join('\n'), 'utf8');
  console.log(`TEXT: ${textPath}`);
}

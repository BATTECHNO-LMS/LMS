'use strict';

const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const { cellPlainText, countBidiVisual } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.formFill');

async function main() {
  const zipPath = path.join(__dirname, '../tmp/mutah-excel98-export/جامعة_مؤتة_تقارير_تقييم_التدريب_الميداني.zip');
  const zip = await JSZip.loadAsync(fs.readFileSync(zipPath));
  const names = Object.keys(zip.files).filter((name) => !zip.files[name].dir);
  const exts = {};
  for (const name of names) {
    const ext = path.extname(name).toLowerCase() || '(none)';
    exts[ext] = (exts[ext] || 0) + 1;
  }
  const folders = [...new Set(names.map((name) => name.split('/').slice(0, 3).join('/')))].sort();
  const one = names.find((name) => name.toLowerCase().endsWith('.docx'));
  const doc = await JSZip.loadAsync(await zip.file(one).async('nodebuffer'));
  const xml = await doc.file('word/document.xml').async('string');
  const tables = [...xml.matchAll(/<w:tbl[\s>][\s\S]*?<\/w:tbl>/g)].map((match) => match[0]);
  const score = tables.find((table) => /مجال التقييم/.test(cellPlainText(table)));
  console.log(
    JSON.stringify(
      {
        fileCount: names.length,
        exts,
        sample: names.slice(0, 6),
        folderCount: folders.length,
        folders: folders.slice(0, 15),
        sampleFile: one,
        hasPdf: names.some((name) => name.toLowerCase().endsWith('.pdf')),
        allDocx: names.every((name) => name.toLowerCase().endsWith('.docx')),
        documentBidiVisual: (xml.match(/<w:bidiVisual\s*\/>/g) || []).length,
        scoreTableBidiVisual: countBidiVisual(score),
        tableCount: tables.length,
        perTableBidi: tables.map((table, index) => ({
          index,
          bidi: countBidiVisual(table),
          scoreGrid: /مجال التقييم/.test(cellPlainText(table)),
        })),
        media: Object.keys(doc.files).filter((name) => name.startsWith('word/media/')),
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

'use strict';

const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

async function main() {
  const dir = path.join(__dirname, '../tmp/mutah-word-qa');
  const file = fs.readdirSync(dir).find((name) => name.includes('212022221209'));
  const zip = await JSZip.loadAsync(fs.readFileSync(path.join(dir, file)));
  const xml = await zip.file('word/document.xml').async('string');
  const media = Object.keys(zip.files).filter((name) => name.startsWith('word/media/'));
  const rels = Object.keys(zip.files).filter((name) => name.includes('_rels'));
  console.log(
    JSON.stringify(
      {
        file,
        media,
        rels,
        bidiVisual: (xml.match(/<w:bidiVisual\s*\/>/g) || []).length,
        paragraphBidi: (xml.match(/<w:bidi\s*\/>/g) || []).length,
        pageBreaks: (xml.match(/w:type="page"/g) || []).length,
        sectPr: (xml.match(/<w:sectPr/g) || []).length,
        hasStyles: Boolean(zip.file('word/styles.xml')),
        hasSettings: Boolean(zip.file('word/settings.xml')),
        contentTypes: Boolean(zip.file('[Content_Types].xml')),
        hasCommentsStatus: /حالة الطالب/.test(xml),
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

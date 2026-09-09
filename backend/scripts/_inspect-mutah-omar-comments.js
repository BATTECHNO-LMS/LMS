'use strict';

const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const { cellPlainText } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.formFill');

async function main() {
  const dir = path.join(__dirname, '../tmp/mutah-word-qa');
  const file = fs.readdirSync(dir).find((name) => name.includes('120232222080'));
  const zip = await JSZip.loadAsync(fs.readFileSync(path.join(dir, file)));
  const xml = await zip.file('word/document.xml').async('string');
  const text = cellPlainText(xml);
  console.log(
    JSON.stringify(
      {
        file,
        notEligible: /غير مؤهل/.test(text),
        incomplete: /غير مكتمل/.test(text),
        commentsSnippet: (text.match(/حالة الطالب[\s\S]{0,80}/) || [''])[0],
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

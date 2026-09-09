'use strict';

const JSZip = require('jszip');
const fs = require('fs');
const { officialTemplatePath } = require('./lib/mutahOfficialEvaluationTemplate');

async function main() {
  const zip = await JSZip.loadAsync(fs.readFileSync(officialTemplatePath()));
  const xml = await zip.file('word/document.xml').async('string');
  const settingsFile = zip.file('word/settings.xml');
  const settings = settingsFile ? await settingsFile.async('string') : '';
  const sect = (xml.match(/<w:sectPr[\s>][\s\S]*?<\/w:sectPr>/) || [''])[0];
  console.log('sectPr bidi', /w:bidi/.test(sect));
  console.log('sectPr snippet', sect.slice(0, 800));
  console.log('settings themeFontLang', (settings.match(/<w:themeFontLang[\s\S]*?\/>/) || [''])[0]);
  console.log('p bidi count', (xml.match(/<w:bidi\s*\/>/g) || []).length);
  console.log('jc right count', (xml.match(/w:val="right"/g) || []).length);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

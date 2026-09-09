'use strict';

const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

function text(xml) {
  return String(xml)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function inspect(filePath) {
  const zip = await JSZip.loadAsync(fs.readFileSync(filePath));
  const xml = await zip.file('word/document.xml').async('string');
  const tables = [...xml.matchAll(/<w:tbl[\s>][\s\S]*?<\/w:tbl>/g)].map((m) => m[0]);
  return {
    file: path.basename(filePath),
    comments: text(tables[4]),
    commentsParas: (tables[4].match(/<w:p\b/g) || []).length,
    identity: text(tables[1]).slice(0, 400),
    org: text(tables[2]).slice(0, 250),
  };
}

async function main() {
  const dir = path.join(__dirname, '../tmp/mutah-word-qa-final');
  const files = fs.readdirSync(dir).filter((n) => n.endsWith('.docx'));
  const out = [];
  for (const file of files) out.push(await inspect(path.join(dir, file)));
  console.log(JSON.stringify(out, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

'use strict';

const fs = require('fs');
const JSZip = require('jszip');
const { officialTemplatePath } = require('./lib/mutahOfficialEvaluationTemplate');

function text(xml) {
  return String(xml)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  const zip = await JSZip.loadAsync(fs.readFileSync(officialTemplatePath()));
  const xml = await zip.file('word/document.xml').async('string');
  const tables = [...xml.matchAll(/<w:tbl[\s>][\s\S]*?<\/w:tbl>/g)].map((m) => m[0]);
  const summary = tables.map((table, i) => {
    const rows = [...table.matchAll(/<w:tr[\s>][\s\S]*?<\/w:tr>/g)];
    const paras = [...table.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)];
    return {
      i,
      chars: text(table).length,
      preview: text(table).slice(0, 90),
      rows: rows.length,
      paragraphs: paras.length,
      trHeight: (table.match(/<w:trHeight[^/]*\/>/g) || []).slice(0, 4),
      empty: text(table).length < 40,
    };
  });
  console.log(JSON.stringify({ tableCount: tables.length, summary }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

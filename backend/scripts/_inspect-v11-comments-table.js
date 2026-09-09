'use strict';

const fs = require('fs');
const JSZip = require('jszip');
const { officialTemplatePath } = require('./lib/mutahOfficialEvaluationTemplate');

async function main() {
  const zip = await JSZip.loadAsync(fs.readFileSync(officialTemplatePath()));
  const xml = await zip.file('word/document.xml').async('string');
  const tables = [...xml.matchAll(/<w:tbl[\s>][\s\S]*?<\/w:tbl>/g)].map((m) => m[0]);
  const comments = tables[4];
  const paras = [...comments.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map((m) => m[0]);
  console.log(
    JSON.stringify(
      {
        tblPr: (comments.match(/<w:tblPr>[\s\S]*?<\/w:tblPr>/) || [''])[0],
        trPr: (comments.match(/<w:trPr>[\s\S]*?<\/w:trPr>/) || [''])[0],
        tcPr: (comments.match(/<w:tcPr>[\s\S]*?<\/w:tcPr>/) || [''])[0],
        paragraphs: paras.map((p) => ({
          pPr: (p.match(/<w:pPr>[\s\S]*?<\/w:pPr>/) || [''])[0],
          rPr: (p.match(/<w:rPr>[\s\S]*?<\/w:rPr>/) || [''])[0],
          text: p.replace(/<[^>]+>/g, ''),
          len: p.length,
        })),
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

'use strict';

const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const { officialTemplatePath } = require('./lib/mutahOfficialEvaluationTemplate');

function text(xml) {
  return String(xml)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function inspect(label, buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file('word/document.xml').async('string');
  const tables = [...xml.matchAll(/<w:tbl[\s>][\s\S]*?<\/w:tbl>/g)].map((m) => m[0]);
  const comments = tables[4];
  const score = tables.find((table) => /مجال التقييم/.test(text(table)));
  return {
    label,
    bytes: buffer.length,
    xmlLen: xml.length,
    lastRenderedPageBreaks: (xml.match(/w:lastRenderedPageBreak/g) || []).length,
    pageBreaks: (xml.match(/<w:br[^>]*w:type="page"/g) || []).length,
    tables: tables.length,
    commentsParas: comments ? (comments.match(/<w:p\b/g) || []).length : 0,
    commentsText: comments ? text(comments).slice(0, 240) : null,
    scoreBidi: score ? /w:bidiVisual/.test(score) : null,
    tblpPr: score ? /w:tblpPr/.test(score) : null,
    bidiCount: (xml.match(/<w:bidi\s*\/>/g) || []).length,
    jcRight: (xml.match(/<w:jc w:val="right"\s*\/>/g) || []).length,
  };
}

async function main() {
  const source = await inspect('source', fs.readFileSync(officialTemplatePath()));
  const qaDir = path.join(__dirname, '../tmp/mutah-word-qa');
  const finalDir = path.join(__dirname, '../tmp/mutah-v11-finalize');
  const qaEligible = fs.readdirSync(qaDir).find((n) => n.includes('212022221209'));
  const prodOmar = fs.readdirSync(finalDir).find((n) => n.includes('120222231170'));
  const qa = qaEligible ? await inspect('qa-eligible', fs.readFileSync(path.join(qaDir, qaEligible))) : null;
  const prod = prodOmar ? await inspect('prod-omar', fs.readFileSync(path.join(finalDir, prodOmar))) : null;
  console.log(JSON.stringify({ source, qa, prod }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

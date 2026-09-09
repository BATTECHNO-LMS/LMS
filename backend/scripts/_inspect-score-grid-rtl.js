'use strict';

const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const { officialTemplatePath } = require('./lib/mutahOfficialEvaluationTemplate');
const formFill = require('../src/modules/fieldTraining/fieldTrainingEvaluation.formFill');

async function main() {
  const buf = fs.readFileSync(officialTemplatePath());
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file('word/document.xml').async('string');
  const tables = [...xml.matchAll(/<w:tbl[\s>][\s\S]*?<\/w:tbl>/g)].map((m) => m[0]);
  const score = tables.find((t) => /مجال التقييم/.test(formFill.cellPlainText(t)));
  console.log(
    JSON.stringify(
      {
        path: officialTemplatePath(),
        hasBidiVisual: /w:bidiVisual/.test(score),
        rawHeaders: formFill.scoreGridHeaderCells(score),
        isVisualLtr: formFill.scoreGridIsVisualLtr(score),
        afterHeaders: formFill.scoreGridHeaderCells(formFill.ensureScoreGridRtl(score)),
        afterBidiCount: formFill.countBidiVisual(formFill.ensureScoreGridRtl(score)),
      },
      null,
      2
    )
  );

  // Fill with known scores C1=1..C5=5 and inspect checkmark columns
  const values = {
    criterion_1_score: 1,
    criterion_2_score: 2,
    criterion_3_score: 3,
    criterion_4_score: 4,
    criterion_5_score: 5,
    professional_evaluation_total: 15,
  };
  const filled = formFill.fillScoreGridTable(score, values);
  const headers = formFill.scoreGridHeaderCells(filled);
  const rows = [...filled.matchAll(/<w:tr[\s>][\s\S]*?<\/w:tr>/g)].map((m) => m[0]);
  const markCols = [];
  for (let i = 1; i <= 5; i += 1) {
    const cells = [...rows[i].matchAll(/<w:tc[\s>][\s\S]*?<\/w:tc>/g)].map((m) => m[0]);
    const col = cells.findIndex((c) => /✓|✔/.test(formFill.cellPlainText(c)));
    markCols.push({ criterion: i, checkCol: col, headerAtCol: headers[col] });
  }
  console.log(JSON.stringify({ headers, markCols }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

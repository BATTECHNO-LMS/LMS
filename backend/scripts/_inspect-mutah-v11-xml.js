'use strict';

const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { prisma } = require('../src/config/db');
const { getProvider } = require('../src/shared/storage/storageProvider');

const V11_ID = 'bd3797b2-6131-466a-a41a-25d460105f46';

function cellPlainText(xml) {
  return String(xml || '')
    .replace(/<w:tab\/>/g, ' ')
    .replace(/<w:br[^/]*\/>/g, ' ')
    .replace(/<\/w:p>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function inspectBuffer(label, buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file('word/document.xml').async('string');
  const tables = [...xml.matchAll(/<w:tbl[\s>][\s\S]*?<\/w:tbl>/g)].map((m) => m[0]);
  const score = tables.find((table) => /مجال التقييم/.test(cellPlainText(table)));
  const tblPr = (score.match(/<w:tblPr>[\s\S]*?<\/w:tblPr>/) || [''])[0];
  const rows = [...score.matchAll(/<w:tr[\s>][\s\S]*?<\/w:tr>/g)];
  const headers = [...rows[0][0].matchAll(/<w:tc[\s>][\s\S]*?<\/w:tc>/g)].map((c) => cellPlainText(c[0]));
  const media = Object.keys(zip.files).filter((n) => n.startsWith('word/media/'));
  const pageBreaks = (xml.match(/w:lastRenderedPageBreak/g) || []).length;
  const sectPr = (xml.match(/<w:sectPr[\s>][\s\S]*?<\/w:sectPr>/) || [''])[0];
  const emptyTables = tables
    .map((table, i) => ({ i, text: cellPlainText(table).slice(0, 80), len: cellPlainText(table).length }))
    .filter((row) => row.len < 40);
  return {
    label,
    bytes: buffer.length,
    media,
    bidiVisual: /w:bidiVisual/.test(tblPr),
    tblpPr: /w:tblpPr/.test(tblPr),
    jc: (tblPr.match(/<w:jc[^>]*>/) || [''])[0],
    headers,
    headerCount: headers.length,
    scoreRows: rows.length,
    lastRenderedPageBreaks: pageBreaks,
    pgSz: (sectPr.match(/<w:pgSz[^>]*>/) || [''])[0],
    pgMar: (sectPr.match(/<w:pgMar[^>]*>/) || [''])[0],
    emptyTables,
    stamp: /الختم الرسمي/.test(xml),
    signature: /التوقيع/.test(xml),
  };
}

async function main() {
  const row = await prisma.field_training_evaluation_templates.findUnique({ where: { id: V11_ID } });
  const file = await prisma.files.findFirst({ where: { id: row.original_file_id, deleted_at: null } });
  const dbBuffer = await getProvider().getObjectBuffer(file.storage_key);
  const bundled = fs.readFileSync(
    path.join(__dirname, '../assets/field-training/mutah-official-evaluation.docx')
  );
  const templates = await prisma.field_training_evaluation_templates.findMany({
    where: { university_id: row.university_id },
    select: { id: true, version: true, is_default: true, is_active: true, archived_at: true, original_file_id: true },
    orderBy: { version: 'desc' },
  });
  const opp = await prisma.field_training_opportunities.findUnique({
    where: { id: '6c8783ec-49fd-428e-83e2-8b65e52c3b4f' },
    select: { evaluation_template_id: true, title: true },
  });
  console.log(
    JSON.stringify(
      {
        db: await inspectBuffer('db-v11', dbBuffer),
        bundled: await inspectBuffer('bundled', bundled),
        templateMeta: {
          id: row.id,
          version: row.version,
          isDefault: row.is_default,
          isActive: row.is_active,
          archived: row.archived_at,
          fillMode: row.validation_json?.fillMode,
        },
        templates,
        opportunityAssigned: opp,
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });

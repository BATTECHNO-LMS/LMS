'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const renderer = require('../src/modules/fieldTraining/fieldTrainingEvaluation.renderer');
const { convertFilledDocxToPdf, findSoffice } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.pdf');

describe('official document renderer', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    renderer.invalidateRendererCache();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    renderer.invalidateRendererCache();
  });

  it('prefers LIBREOFFICE_PATH when the file exists', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lo-path-'));
    const fake = path.join(dir, 'soffice.exe');
    fs.writeFileSync(fake, '');
    process.env.LIBREOFFICE_PATH = fake;
    assert.equal(renderer.discoverLibreOfficeExecutable({ refresh: true }), fake);
  });

  it('ignores invalid LIBREOFFICE_PATH and falls back to platform candidates', () => {
    process.env.LIBREOFFICE_PATH = path.join(os.tmpdir(), 'missing-soffice.exe');
    const hit = renderer.discoverLibreOfficeExecutable({ refresh: true });
    if (process.platform === 'win32') {
      const common = 'C:\\Program Files\\LibreOffice\\program\\soffice.exe';
      assert.equal(hit, fs.existsSync(common) ? common : hit);
    } else {
      assert.ok(hit === null || fs.existsSync(hit));
    }
  });

  it('returns unavailable status when renderer cannot be resolved', () => {
    if (findSoffice()) {
      console.log('SKIP: LibreOffice installed on host — unavailable-path test not applicable');
      return;
    }
    process.env.LIBREOFFICE_PATH = path.join(os.tmpdir(), 'definitely-missing-soffice.exe');
    process.env.SOFFICE_PATH = '';
    const status = renderer.getOfficialDocumentRendererStatus({ refresh: true });
    assert.equal(status.available, false);
    assert.equal(status.engine, 'libreoffice');
    assert.equal(status.version, null);
    assert.equal('executable' in status, false);
  });

  it('does not expose full executable path in default admin-safe status', () => {
    const status = renderer.getOfficialDocumentRendererStatus({ refresh: true });
    assert.equal('executable' in status, false);
    if (status.available) {
      assert.ok(status.executableBasename);
    }
  });

  it('runs bounded concurrent conversions without cross-contamination', async () => {
    const soffice = findSoffice();
    if (!soffice) {
      console.log('SKIP: LibreOffice not installed');
      return;
    }

    const { officialTemplatePath } = require('../scripts/lib/mutahOfficialEvaluationTemplate');
    const template = fs.readFileSync(officialTemplatePath());
    const buffers = await Promise.all(
      Array.from({ length: 4 }, () => renderer.convertDocxBufferWithLibreOffice(template, soffice))
    );
    assert.equal(buffers.length, 4);
    const hashes = new Set(buffers.map((buf) => buf.toString('base64').slice(0, 40)));
    assert.equal(hashes.size, 1);
    for (const buf of buffers) {
      assert.ok(buf.length > 1000);
    }
  });

  it('converts official Mutah DOCX to a 2-page PDF when LibreOffice is available', async () => {
    const soffice = findSoffice();
    if (!soffice) {
      console.log('SKIP: LibreOffice not installed');
      return;
    }

    const { officialTemplatePath } = require('../scripts/lib/mutahOfficialEvaluationTemplate');
    const docx = fs.readFileSync(officialTemplatePath());
    const pdf = await convertFilledDocxToPdf(docx, { expectedPageCount: 2 });
    assert.ok(pdf.length > 1000);
    const pdfParse = require('pdf-parse');
    const parsed = await pdfParse(pdf);
    assert.equal(parsed.numpages, 2);
  });

  it('reports version when LibreOffice is available', () => {
    const soffice = findSoffice();
    if (!soffice) {
      console.log('SKIP: LibreOffice not installed');
      return;
    }
    const version = renderer.readLibreOfficeVersion(soffice);
    assert.match(String(version), /LibreOffice/i);
  });
});

describe('convertFilledDocxToPdf fail-closed', () => {
  it('throws when renderer is unavailable', async () => {
    if (findSoffice()) {
      console.log('SKIP: LibreOffice installed on host — unavailable-path test not applicable');
      return;
    }
    const previous = process.env.LIBREOFFICE_PATH;
    process.env.LIBREOFFICE_PATH = path.join(os.tmpdir(), 'missing-soffice-for-test.exe');
    renderer.invalidateRendererCache();
    await assert.rejects(
      () => convertFilledDocxToPdf(Buffer.from('not-a-docx')),
      (err) => err.code === 'FIELD_TRAINING_TEMPLATE_RENDER_FAILED'
    );
    process.env.LIBREOFFICE_PATH = previous;
    renderer.invalidateRendererCache();
  });
});

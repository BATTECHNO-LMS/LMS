'use strict';

/**
 * Phase 3 application hardening unit tests — local only, no network.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const { sanitizeCtaUrl, sanitizeHtml } = require('../src/modules/contentCms/contentCms.shared');
const { sanitizeAppRelativePath, sanitizeCtaOrAppUrl } = require('../src/shared/security/safeAppPath');
const { sanitizeSpreadsheetCell, escapeCsvCell } = require('../src/shared/security/spreadsheetSafe');
const { toCsv } = require('../src/modules/reports/reports.service');
const { resolveLocalUploadPath } = require('../src/modules/trainingPrograms/trainingReportPdf.service');

describe('Phase 3 — open redirect / CTA URLs', () => {
  it('rejects protocol-relative and backslash paths', () => {
    assert.equal(sanitizeCtaUrl('//evil.example/phish'), null);
    assert.equal(sanitizeCtaUrl('/\\evil.example'), null);
    assert.equal(sanitizeCtaUrl('javascript:alert(1)'), null);
    assert.equal(sanitizeCtaUrl('data:text/html,hi'), null);
    assert.equal(sanitizeAppRelativePath('//evil.example'), null);
  });

  it('allows safe relative and https URLs', () => {
    assert.equal(sanitizeCtaUrl('/admin/users'), '/admin/users');
    assert.equal(sanitizeCtaUrl('https://example.com/x'), 'https://example.com/x');
    assert.equal(sanitizeCtaOrAppUrl('mailto:a@b.com'), 'mailto:a@b.com');
  });
});

describe('Phase 3 — HTML sanitizer', () => {
  it('strips script and event handlers', () => {
    const out = sanitizeHtml('<p>ok</p><script>alert(1)</script><img src=x onerror=alert(1)>');
    assert.equal(out.includes('<script'), false);
    assert.equal(/onerror/i.test(out), false);
    assert.match(out, /<p>/);
  });

  it('neutralizes javascript: href', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">x</a>');
    assert.equal(/javascript:/i.test(out), false);
  });
});

describe('Phase 3 — spreadsheet formula injection', () => {
  it('prefixes dangerous leading characters', () => {
    assert.equal(sanitizeSpreadsheetCell('=1+1'), "'=1+1");
    assert.equal(sanitizeSpreadsheetCell('+SUM(1,1)'), "'+SUM(1,1)");
    assert.equal(sanitizeSpreadsheetCell('@SUM(1,1)'), "'@SUM(1,1)");
    assert.equal(sanitizeSpreadsheetCell('-HYPERLINK("x")'), "'-HYPERLINK(\"x\")");
    assert.equal(sanitizeSpreadsheetCell('Normal Name'), 'Normal Name');
    assert.equal(sanitizeSpreadsheetCell(42), 42);
  });

  it('CSV export neutralizes formula cells', () => {
    const csv = toCsv([{ name: '=1+1', score: 10 }]);
    assert.match(csv, /'=1\+1/);
    assert.doesNotMatch(csv, /^name,score\n=1\+1/m);
  });

  it('escapeCsvCell quotes commas after neutralization', () => {
    assert.equal(escapeCsvCell('=1,2'), `"'=1,2"`);
  });
});

describe('Phase 3 — logo path confinement', () => {
  it('rejects path traversal outside upload root', () => {
    assert.equal(resolveLocalUploadPath('../../etc/passwd'), null);
    assert.equal(resolveLocalUploadPath('C:\\\\Windows\\\\win.ini'), null);
    assert.equal(resolveLocalUploadPath('https://evil.example/x.png'), null);
  });
});

describe('Phase 3 — static / source guards', () => {
  it('evaluation upload has mime/extension filter', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../src/modules/fieldTraining/fieldTrainingEvaluation.controller.js'),
      'utf8'
    );
    assert.match(src, /fileFilter/);
    assert.match(src, /\.docx/);
  });

  it('pdfRenderer blocks outbound network except allowlisted font hosts', () => {
    const src = fs.readFileSync(path.join(__dirname, '../src/modules/analytics/pdfRenderer.js'), 'utf8');
    assert.match(src, /setRequestInterception\(true\)/);
    assert.match(src, /fonts\.googleapis\.com/);
    assert.match(src, /blockedbyclient/);
  });

  it('helmet enables referrerPolicy and frameguard', () => {
    const src = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
    assert.match(src, /referrerPolicy/);
    assert.match(src, /frameguard/);
  });
});

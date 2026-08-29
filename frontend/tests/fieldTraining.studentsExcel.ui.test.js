/**
 * Field training students Excel export UI wiring.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8');
}

const reportPage = readSrc('../src/pages/shared/fieldTrainingReports/FieldTrainingApplicationsReportPage.jsx');
const reportService = readSrc('../src/features/fieldTrainingReports/fieldTrainingReports.service.js');
const appsPage = readSrc('../src/pages/admin/fieldTraining/AdminFieldTrainingApplicationsPage.jsx');
const manageTab = readSrc('../src/pages/admin/fieldTraining/components/manage/ManageApplicationsTab.jsx');
const ftService = readSrc('../src/features/fieldTraining/fieldTraining.service.js');
const arReports = readSrc('../src/i18n/locales/ar/fieldTrainingReports.json');
const enReports = readSrc('../src/i18n/locales/en/fieldTrainingReports.json');
const arFt = readSrc('../src/i18n/locales/ar/fieldTraining.json');
const enFt = readSrc('../src/i18n/locales/en/fieldTraining.json');

describe('field training students excel UI', () => {
  it('uses the required Arabic and English button labels', () => {
    assert.match(arReports, /"button": "تصدير الطلاب Excel"/);
    assert.match(enReports, /"button": "Export Students to Excel"/);
    assert.match(arFt, /"button": "تصدير الطلاب Excel"/);
    assert.match(enFt, /"button": "Export Students to Excel"/);
    assert.match(arReports, /لا يوجد طلاب مطابقون للتصدير/);
    assert.match(arFt, /لا يوجد طلاب مطابقون للتصدير/);
  });

  it('sends the active report filters and downloads the XLSX blob', () => {
    assert.match(reportPage, /exportFieldTrainingStudentsExcel\(params, mode\)/);
    assert.match(reportPage, /FieldTrainingStudentsExcelButton/);
    assert.match(reportService, /\$\{base\}\/students\/export\/excel/);
    assert.match(reportService, /normalizeParams\(params\)/);
    assert.match(reportService, /responseType: 'blob'/);
    assert.match(reportService, /saveFieldTrainingSubmissionBlob/);
  });

  it('sends opportunity-page filters and downloads the XLSX response', () => {
    assert.match(appsPage, /exportOpportunityStudentsExcel\(id, listParams/);
    assert.match(appsPage, /FieldTrainingStudentsExcelButton/);
    assert.match(manageTab, /exportOpportunityStudentsExcel\(opportunityId, listParams/);
    assert.match(ftService, /applications\/export\/excel/);
    assert.match(ftService, /responseType: 'blob'/);
    assert.match(ftService, /saveFieldTrainingSubmissionBlob/);
  });
});

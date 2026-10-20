import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8');
}

describe('field training phase 2 UI wiring', () => {
  it('wires student logbook + portfolio tabs and overview cards', () => {
    const tabs = readSrc('../src/pages/student/fieldTraining/components/StudentTrainingTabNav.jsx');
    const detail = readSrc('../src/pages/student/StudentFieldTrainingDetailPage.jsx');
    const overview = readSrc('../src/pages/student/fieldTraining/components/StudentOverviewTab.jsx');
    const logbook = readSrc('../src/pages/student/fieldTraining/components/StudentLogbookTab.jsx');
    const portfolio = readSrc('../src/pages/student/fieldTraining/components/StudentPortfolioTab.jsx');
    const service = readSrc('../src/features/fieldTraining/fieldTraining.service.js');
    const ar = readSrc('../src/i18n/locales/ar/fieldTraining.json');

    assert.match(tabs, /'logbook'/);
    assert.match(tabs, /'portfolio'/);
    assert.match(detail, /StudentLogbookTab/);
    assert.match(detail, /StudentPortfolioTab/);
    assert.match(overview, /ft-phase2-card/);
    assert.match(logbook, /saveDraft/);
    assert.match(logbook, /submitStudentLogbookEntry/);
    assert.match(portfolio, /exportPdf/);
    assert.match(portfolio, /noScoreNote/);
    assert.match(service, /\/logbook/);
    assert.match(service, /\/portfolio\/pdf/);
    assert.match(ar, /سجل التدريب/);
    assert.match(ar, /ملف الإنجاز/);
    assert.match(ar, /ساعات إعلامية فقط/);
  });

  it('command center shows logbook pending KPIs', () => {
    const cc = readSrc('../src/pages/admin/fieldTraining/components/manage/ManageCommandCenterTab.jsx');
    const ar = readSrc('../src/i18n/locales/ar/fieldTraining.json');
    assert.match(cc, /logbook_pending/);
    assert.match(cc, /logbook_revision_requested/);
    assert.match(ar, /سجلات تدريب تنتظر المراجعة/);
  });
});

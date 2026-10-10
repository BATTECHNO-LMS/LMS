/**
 * Eligibility bulk student-report ZIP export UI wiring.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8');
}

describe('field training eligibility bulk student reports UI', () => {
  it('exposes the Arabic export action and confirmation on the eligibility tab', () => {
    const tab = readSrc(
      '../src/pages/admin/fieldTraining/components/manage/EligibilityStudentCard.jsx'
    );
    const manage = readSrc(
      '../src/pages/admin/fieldTraining/components/manage/ManageEligibilityTab.jsx'
    );
    const ar = JSON.parse(readSrc('../src/i18n/locales/ar/fieldTraining.json'));

    assert.equal(ar.manageHub.bulkStudentReports.button, 'تصدير جميع تقارير الطلاب');
    assert.match(manage, /previewBulkStudentReports/);
    assert.match(manage, /startBulkStudentReports/);
    assert.match(manage, /downloadBulkStudentReportsZip/);
    assert.match(manage, /FileArchive/);
    assert.match(manage, /ConfirmationModal/);
    assert.match(manage, /exportBusy/);
    assert.match(manage, /eligibility_status/);
    assert.match(manage, /matching_count/);
    assert.doesNotMatch(manage, /studentIds/);
    assert.match(tab, /comprehensiveReport/);
  });

  it('calls the bulk export API through the shared field training service', () => {
    const service = readSrc('../src/features/fieldTraining/fieldTraining.service.js');
    assert.match(service, /reports\/students\/bulk-export\/preview/);
    assert.match(service, /reports\/students\/bulk-export`/);
    assert.match(service, /reports\/students\/bulk-export\/jobs\/\$\{jobId\}\/download/);
    assert.match(service, /x-zip-included/);
    assert.match(service, /responseType: 'blob'/);
    assert.match(service, /assertBlobDownloadSuccess/);
  });
});

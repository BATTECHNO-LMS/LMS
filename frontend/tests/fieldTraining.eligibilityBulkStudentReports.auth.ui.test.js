/**
 * Eligibility bulk ZIP auth/download wiring — must use canonical apiClient, not window.open.
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

describe('field training eligibility bulk student reports auth download', () => {
  it('downloads the ZIP through apiClient blob requests (no direct navigation)', () => {
    const service = readSrc('../src/features/fieldTraining/fieldTraining.service.js');
    const tab = readSrc(
      '../src/pages/admin/fieldTraining/components/manage/ManageEligibilityTab.jsx'
    );
    const downloadHelper = readSrc('../src/features/fieldTraining/fieldTrainingDownload.js');
    const apiClientSrc = readSrc('../src/services/apiClient.js');

    assert.match(service, /apiClient\.get\(/);
    assert.match(service, /reports\/students\/bulk-export\/jobs\/\$\{jobId\}\/download/);
    assert.match(service, /responseType:\s*'blob'/);
    assert.match(service, /assertBlobDownloadSuccess/);
    assert.match(service, /rethrowBlobApiError/);
    assert.doesNotMatch(service, /window\.location\.href\s*=/);
    assert.doesNotMatch(service, /window\.open\([^)]*bulk-export/);
    assert.doesNotMatch(service, /\?access_token=/);
    assert.doesNotMatch(service, /\?token=/);

    assert.match(tab, /downloadBulkStudentReportsZip/);
    assert.match(tab, /downloadInFlight/);
    assert.match(tab, /sessionExpired/);
    assert.doesNotMatch(tab, /window\.location/);
    assert.doesNotMatch(tab, /window\.open/);

    assert.match(downloadHelper, /createObjectURL/);
    assert.match(downloadHelper, /revokeObjectURL/);
    assert.match(downloadHelper, /assertBlobDownloadSuccess/);
    assert.match(downloadHelper, /setTimeout\(\(\) => URL\.revokeObjectURL/);

    assert.match(apiClientSrc, /Authorization/);
    assert.match(apiClientSrc, /Bearer \$\{token\}/);
    assert.match(apiClientSrc, /triggerUnauthorized/);
  });

  it('parses JSON auth errors returned as blobs and never shows [object Blob]', async () => {
    const { rethrowBlobApiError, assertBlobDownloadSuccess } = await import(
      '../src/features/fieldTraining/fieldTrainingDownload.js'
    );

    const authBlob = new Blob(
      [
        JSON.stringify({
          success: false,
          message: 'انتهت جلستك. سجّل الدخول مرة أخرى.',
          code: 'UNAUTHORIZED',
        }),
      ],
      { type: 'application/json' }
    );
    const err = { response: { status: 401, data: authBlob } };
    await assert.rejects(
      () => rethrowBlobApiError(err),
      (thrown) => {
        assert.equal(thrown.response.data.code, 'UNAUTHORIZED');
        assert.match(thrown.response.data.message, /انتهت جلستك/);
        assert.notEqual(String(thrown.response.data), '[object Blob]');
        return true;
      }
    );

    const fakeRes = {
      status: 200,
      headers: { 'content-type': 'application/json' },
      data: new Blob(
        [
          JSON.stringify({
            success: false,
            message: 'انتهت جلستك. سجّل الدخول مرة أخرى.',
            code: 'UNAUTHORIZED',
          }),
        ],
        { type: 'application/json' }
      ),
      config: { headers: { Authorization: 'Bearer x' } },
    };
    await assert.rejects(
      () => assertBlobDownloadSuccess(fakeRes),
      (thrown) => {
        assert.equal(thrown.response.status, 401);
        assert.equal(thrown.response.data.code, 'UNAUTHORIZED');
        return true;
      }
    );
  });

  it('schedules object URL revoke after click (source contract)', () => {
    const downloadHelper = readSrc('../src/features/fieldTraining/fieldTrainingDownload.js');
    assert.match(downloadHelper, /URL\.createObjectURL\(blob\)/);
    assert.match(downloadHelper, /a\.download = filename/);
    assert.match(downloadHelper, /a\.click\(\)/);
    assert.match(downloadHelper, /setTimeout\(\(\) => URL\.revokeObjectURL\(url\), 1500\)/);
  });
});

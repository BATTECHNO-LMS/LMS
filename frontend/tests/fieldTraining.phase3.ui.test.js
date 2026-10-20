import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8');
}

describe('field training phase 3 UI wiring', () => {
  it('wires QR live screen, student confirm, interventions, external portal', () => {
    const qrLive = readSrc(
      '../src/pages/admin/fieldTraining/components/manage/ManageLiveQrAttendance.jsx'
    );
    const studentQr = readSrc('../src/pages/student/StudentQrAttendancePage.jsx');
    const interventions = readSrc(
      '../src/pages/admin/fieldTraining/components/manage/ManageInterventionsTab.jsx'
    );
    const extPortal = readSrc('../src/pages/external/ExternalSupervisorPortalPage.jsx');
    const tabNav = readSrc('../src/pages/admin/fieldTraining/components/manage/ManageTabNav.jsx');
    const manage = readSrc('../src/pages/admin/fieldTraining/AdminFieldTrainingManagePage.jsx');
    const service = readSrc('../src/features/fieldTraining/fieldTraining.service.js');
    const ar = readSrc('../src/i18n/locales/ar/fieldTraining.json');
    const router = readSrc('../src/app/router/index.jsx');

    assert.match(qrLive, /fetchLiveQrAttendance/);
    assert.match(qrLive, /QRCode/);
    assert.match(studentQr, /confirmQrAttendance/);
    assert.match(studentQr, /تم تسجيل حضورك بنجاح|studentSuccess/);
    assert.match(interventions, /openInterventionCase/);
    assert.match(interventions, /لا توجد حالات متابعة مفتوحة|interventions\.empty/);
    assert.match(extPortal, /fetchExternalSupervisorDashboard/);
    assert.match(extPortal, /لا يوجد طلاب مسندون إليك حاليًا|externalPortal\.empty/);
    assert.match(tabNav, /interventions/);
    assert.match(tabNav, /external_supervisors/);
    assert.match(manage, /ManageInterventionsTab/);
    assert.match(manage, /ManageLiveQrAttendance/);
    assert.match(service, /attendance\/qr\/confirm/);
    assert.match(service, /external\/field-training\/dashboard/);
    assert.match(ar, /تم تسجيل حضورك بنجاح/);
    assert.match(ar, /انتهت صلاحية رمز الحضور/);
    assert.match(ar, /حالات المتابعة/);
    assert.match(ar, /بوابة مشرف جهة التدريب/);
    assert.match(router, /field-training\/attendance\/qr/);
    assert.match(router, /external\/field-training/);
  });

  it('encodes only scan_path token into QR image (no auth bearer headers)', () => {
    const qrLive = readSrc(
      '../src/pages/admin/fieldTraining/components/manage/ManageLiveQrAttendance.jsx'
    );
    assert.match(qrLive, /scanPath/);
    assert.match(qrLive, /QRCode\.toDataURL/);
    assert.equal(/Authorization|Bearer\s|access_token/i.test(qrLive), false);
  });
});

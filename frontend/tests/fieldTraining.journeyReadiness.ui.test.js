import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8');
}

describe('field training journey + readiness + command center UI', () => {
  it('student overview wires readiness meter, journey, and next step', () => {
    const overview = readSrc('../src/pages/student/fieldTraining/components/StudentOverviewTab.jsx');
    const journey = readSrc('../src/pages/student/fieldTraining/components/StudentTrainingJourney.jsx');
    const readiness = readSrc('../src/pages/student/fieldTraining/components/StudentReadinessMeter.jsx');
    const detail = readSrc('../src/pages/student/StudentFieldTrainingDetailPage.jsx');
    const ar = readSrc('../src/i18n/locales/ar/fieldTraining.json');

    assert.match(overview, /StudentReadinessMeter/);
    assert.match(overview, /StudentTrainingJourney/);
    assert.match(overview, /nextStep/);
    assert.match(journey, /ft-journey/);
    assert.match(readiness, /completionTitle/);
    assert.match(readiness, /hoursUnit/);
    assert.equal(/\/ 100 points|points\s*\//i.test(readiness), false);
    assert.match(readiness, /hoursUnit/);
    assert.match(detail, /readiness=\{readiness\}/);
    assert.match(detail, /journey=\{journey\}/);
    assert.match(ar, /رحلة التدريب الميداني/);
    assert.match(ar, /جاهزية إكمال التدريب/);
    assert.match(ar, /الخطوة التالية/);
  });

  it('command center tab is wired into manage hub with pagination and filters', () => {
    const tabNav = readSrc('../src/pages/admin/fieldTraining/components/manage/ManageTabNav.jsx');
    const manage = readSrc('../src/pages/admin/fieldTraining/AdminFieldTrainingManagePage.jsx');
    const cc = readSrc('../src/pages/admin/fieldTraining/components/manage/ManageCommandCenterTab.jsx');
    const service = readSrc('../src/features/fieldTraining/fieldTraining.service.js');
    const ar = readSrc('../src/i18n/locales/ar/fieldTraining.json');
    const scss = readSrc('../src/assets/styles/pages/_field-training.scss');

    assert.match(tabNav, /command_center/);
    assert.match(manage, /ManageCommandCenterTab/);
    assert.match(cc, /quick_filter/);
    assert.match(cc, /page_size: 25/);
    assert.match(cc, /emptyTitle/);
    assert.match(service, /command-center/);
    assert.match(service, /progress-snapshot/);
    assert.match(ar, /متابعة التدريب الميداني/);
    assert.match(ar, /لا توجد حالات تتطلب متابعة حاليًا/);
    assert.match(scss, /\.ft-command-center/);
    assert.match(scss, /\.ft-journey/);
    assert.match(scss, /\.ft-readiness/);
  });
});

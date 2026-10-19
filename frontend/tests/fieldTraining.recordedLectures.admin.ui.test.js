import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { moveLecture } from '../src/pages/admin/fieldTraining/components/manage/recordedLectureOrder.js';

const root = path.dirname(fileURLToPath(import.meta.url));

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8');
}

describe('recorded lecture admin order helpers', () => {
  it('moves first to last, last to first, and a middle item', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    assert.deepEqual(moveLecture(items, 0, 3).map((row) => row.id), ['b', 'c', 'd', 'a']);
    assert.deepEqual(moveLecture(items, 3, 0).map((row) => row.id), ['d', 'a', 'b', 'c']);
    assert.deepEqual(moveLecture(items, 2, 1).map((row) => row.id), ['a', 'c', 'b', 'd']);
  });
});

describe('recorded lecture admin UI wiring', () => {
  it('uses dnd-kit, one reorder mutation, playlist sync, and no watch analytics', () => {
    const list = readSrc('../src/pages/admin/fieldTraining/components/manage/RecordedLecturesSortableList.jsx');
    const tab = readSrc('../src/pages/admin/fieldTraining/components/manage/ManageRecordedLecturesTab.jsx');
    const service = readSrc('../src/features/fieldTraining/fieldTraining.service.js');
    const ar = readSrc('../src/i18n/locales/ar/fieldTraining.json');
    assert.match(list, /@dnd-kit\/core/);
    assert.match(list, /GripVertical/);
    assert.match(service, /recorded-lectures\/reorder/);
    assert.match(service, /playlist\/sync\/preview/);
    assert.match(tab, /reorderFailed/);
    assert.match(ar, /مزامنة قائمة التشغيل/);
    assert.match(ar, /تعذر حفظ ترتيب المحاضرات، يرجى المحاولة مرة أخرى\./);
    assert.equal(/watchCount|watchedMinutes|completionPercentage/.test(list), false);
  });

  it('wires per-lecture student progress roster panel', () => {
    const list = readSrc('../src/pages/admin/fieldTraining/components/manage/RecordedLecturesSortableList.jsx');
    const panel = readSrc(
      '../src/pages/admin/fieldTraining/components/manage/ManageRecordedLectureProgressPanel.jsx'
    );
    const service = readSrc('../src/features/fieldTraining/fieldTraining.service.js');
    const ar = readSrc('../src/i18n/locales/ar/fieldTraining.json');
    const en = readSrc('../src/i18n/locales/en/fieldTraining.json');

    assert.match(list, /ManageRecordedLectureProgressPanel/);
    assert.match(list, /progressRoster\.openAction/);
    const hooks = readSrc('../src/features/fieldTraining/hooks/useAdminFieldTraining.js');
    assert.match(panel, /StudentProgressBar/);
    assert.match(panel, /needs_sync/);
    assert.match(hooks, /refetchInterval: options\.refetchInterval \?\? 20000/);
    assert.match(service, /recorded-lectures\/\$\{lectureId\}\/students/);
    assert.match(ar, /الطلاب والتقدم/);
    assert.match(ar, /بحاجة للمزامنة/);
    assert.match(en, /Students & progress/);
    assert.match(panel, /emptyStudents/);
    assert.match(panel, /emptyFilter/);
  });
});

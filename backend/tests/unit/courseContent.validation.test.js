'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('courseContent service exports recorded lecture + material helpers', () => {
  const mod = require('../../src/modules/trainingPrograms/courseContent.service');
  assert.equal(typeof mod.listProgramMaterials, 'function');
  assert.equal(typeof mod.createProgramMaterial, 'function');
  assert.equal(typeof mod.updateProgramMaterial, 'function');
  assert.equal(typeof mod.deleteProgramMaterial, 'function');
  assert.equal(typeof mod.listRecordedLectures, 'function');
  assert.equal(typeof mod.createRecordedLecture, 'function');
  assert.equal(typeof mod.updateRecordedLecture, 'function');
  assert.equal(typeof mod.publishRecordedLecture, 'function');
  assert.equal(typeof mod.deleteRecordedLecture, 'function');
  assert.equal(typeof mod.getMaterialPlaybackUrl, 'function');
  assert.equal(typeof mod.updateTask, 'function');
  assert.equal(mod.RECORDED_LECTURE_TYPE, 'RECORDED_LECTURE');
});

test('updateProgramBody accepts domains and venue settings fields', () => {
  const v = require('../../src/modules/trainingPrograms/trainingPrograms.validation');
  const parsed = v.updateProgramBody.parse({
    title: 'الدبلوم التشغيلي الرقمي',
    domains: ['كتابة المحتوى', 'التصميم'],
    venue: 'عمّان',
    meeting_url: 'https://meet.example.com/x',
    short_description: 'وصف مختصر',
  });
  assert.equal(parsed.title, 'الدبلوم التشغيلي الرقمي');
  assert.deepEqual(parsed.domains, ['كتابة المحتوى', 'التصميم']);
  assert.equal(parsed.venue, 'عمّان');
});

test('createRecordedLectureBody requires title', () => {
  const v = require('../../src/modules/trainingPrograms/trainingPrograms.validation');
  assert.throws(() => v.createRecordedLectureBody.parse({ description: 'x' }));
  const ok = v.createRecordedLectureBody.parse({
    title: 'محاضرة 1',
    file_id: '00000000-0000-4000-8000-000000000001',
  });
  assert.equal(ok.title, 'محاضرة 1');
});

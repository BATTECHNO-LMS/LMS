'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveTraineeDetailSections } = require('../src/modules/trainingPrograms/traineeProgramDetailSections');
const { resolveTrainerCourseSections } = require('../src/modules/trainingPrograms/trainerCourseSections');

test('trainee sections: omitted/all loads every tab dataset', () => {
  const all = resolveTraineeDetailSections();
  assert.equal(all.has('sessions'), true);
  assert.equal(all.has('tasks'), true);
  assert.equal(all.has('assessments'), true);
  assert.equal(all.has('materials'), true);
  assert.equal(all.has('certificate'), true);
  assert.deepEqual([...resolveTraineeDetailSections('all')].sort(), [...all].sort());
});

test('trainee sections: overview skips tab datasets', () => {
  const overview = resolveTraineeDetailSections('overview');
  assert.equal(overview.size, 0);
});

test('trainee sections: lectures maps to materials', () => {
  const wanted = resolveTraineeDetailSections('lectures');
  assert.equal(wanted.has('materials'), true);
  assert.equal(wanted.has('sessions'), false);
});

test('trainer sections: overview skips heavy lists', () => {
  const overview = resolveTrainerCourseSections('overview');
  assert.equal(overview.size, 0);
});

test('trainer sections: attendance maps to sessions', () => {
  const wanted = resolveTrainerCourseSections('attendance');
  assert.equal(wanted.has('sessions'), true);
  assert.equal(wanted.has('trainees'), false);
});

test('trainer sections: progress maps to trainees', () => {
  const wanted = resolveTrainerCourseSections('progress,certificates');
  assert.equal(wanted.has('trainees'), true);
});

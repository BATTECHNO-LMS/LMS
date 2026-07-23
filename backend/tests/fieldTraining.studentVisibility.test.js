'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildStudentWhere } = require('../src/modules/fieldTraining/fieldTraining.service');
const {
  NO_UNIVERSITY_MSG,
  NO_UNIVERSITY_SPECIALTY_MSG,
  NOT_ELIGIBLE_MSG,
} = require('../src/modules/fieldTraining/fieldTraining.access');

const UNI_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const UNI_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SPEC_A = '11111111-1111-4111-8111-111111111111';
const SPEC_B = '22222222-2222-4222-8222-222222222222';

test('buildStudentWhere scopes to student university + university specialty (not canonical specialty)', () => {
  const where = buildStudentWhere({}, UNI_A, SPEC_A);
  assert.ok(where.AND);
  const eligibility = where.AND[0].field_training_opportunity_eligibility.some;
  assert.equal(eligibility.is_active, true);
  assert.equal(eligibility.university_id, UNI_A);
  assert.equal(eligibility.university_specialty_id, SPEC_A);
  assert.equal(eligibility.canonical_specialty_id, undefined);
});

test('buildStudentWhere for university B does not match university A filter', () => {
  const whereA = buildStudentWhere({}, UNI_A, SPEC_A);
  const whereB = buildStudentWhere({}, UNI_B, SPEC_B);
  assert.notEqual(
    whereA.AND[0].field_training_opportunity_eligibility.some.university_id,
    whereB.AND[0].field_training_opportunity_eligibility.some.university_id
  );
  assert.notEqual(
    whereA.AND[0].field_training_opportunity_eligibility.some.university_specialty_id,
    whereB.AND[0].field_training_opportunity_eligibility.some.university_specialty_id
  );
});

test('buildStudentWhere keeps specialty required even when same university has another specialty', () => {
  const where = buildStudentWhere({}, UNI_A, SPEC_B);
  assert.equal(
    where.AND[0].field_training_opportunity_eligibility.some.university_specialty_id,
    SPEC_B
  );
  assert.notEqual(
    where.AND[0].field_training_opportunity_eligibility.some.university_specialty_id,
    SPEC_A
  );
});

test('student FT access messages are explicit Arabic copy', () => {
  assert.match(NO_UNIVERSITY_MSG, /الجامعة والتخصص/);
  assert.match(NO_UNIVERSITY_SPECIALTY_MSG, /الجامعة والتخصص/);
  assert.match(NOT_ELIGIBLE_MSG, /غير متاحة/);
});

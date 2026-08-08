'use strict';

/**
 * Regression: completed_training_hours column + access/mapper contracts.
 * DB-backed checks run only when DATABASE_URL is set and the column exists
 * (after migrate deploy). Pure tests always run.
 */

const test = require('node:test');
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const {
  canManageFieldTraining,
  isFieldTrainingAdmin,
  isAssignedInstructor,
} = require('../src/modules/fieldTraining/fieldTraining.access');
const { mapApplicationRow } = require('../src/modules/fieldTraining/fieldTraining.repository');
const {
  validateCompletedHoursReplacement,
  buildHoursSummary,
} = require('../src/modules/fieldTraining/fieldTraining.hours');
const { updateApplicationHoursBodySchema } = require('../src/modules/fieldTraining/fieldTraining.validation');

const MIGRATION_DIR = path.join(
  __dirname,
  '..',
  'prisma',
  'migrations',
  '20260720140000_field_training_completed_hours'
);

test('migration 20260720140000_field_training_completed_hours is additive with DEFAULT 0', () => {
  const sql = fs.readFileSync(path.join(MIGRATION_DIR, 'migration.sql'), 'utf8');
  assert.match(sql, /ADD COLUMN "completed_training_hours"/i);
  assert.match(sql, /NOT NULL DEFAULT 0/i);
  assert.match(sql, /hours_updated_at/i);
  assert.match(sql, /hours_updated_by_id/i);
  assert.doesNotMatch(sql, /DROP TABLE/i);
  assert.doesNotMatch(sql, /DROP COLUMN/i);
});

test('mapApplicationRow returns completed_training_hours = 0 for legacy/null', () => {
  const mapped = mapApplicationRow({
    id: '00000000-0000-4000-8000-000000000001',
    opportunity_id: '00000000-0000-4000-8000-000000000002',
    student_id: '00000000-0000-4000-8000-000000000003',
    status: 'pending',
    training_status: 'none',
    student_message: null,
    admin_note: null,
    reviewed_by_id: null,
    reviewed_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    completed_training_hours: null,
  });
  assert.equal(mapped.completed_training_hours, 0);
});

test('mapApplicationRow preserves recorded completed hours', () => {
  const mapped = mapApplicationRow({
    id: '00000000-0000-4000-8000-000000000001',
    opportunity_id: '00000000-0000-4000-8000-000000000002',
    student_id: '00000000-0000-4000-8000-000000000003',
    status: 'approved',
    training_status: 'in_training',
    student_message: null,
    admin_note: null,
    reviewed_by_id: null,
    reviewed_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    completed_training_hours: 42,
  });
  assert.equal(mapped.completed_training_hours, 42);
});

test('hours update validation rejects negative / non-numeric / over-required', () => {
  assert.equal(validateCompletedHoursReplacement(-1, 40).ok, false);
  assert.equal(validateCompletedHoursReplacement('abc', 40).ok, false);
  assert.equal(validateCompletedHoursReplacement(50, 40).code, 'HOURS_EXCEED_REQUIRED');
  assert.equal(updateApplicationHoursBodySchema.safeParse({ completed_hours: -1 }).success, false);
  assert.equal(updateApplicationHoursBodySchema.safeParse({ completed_hours: 'x' }).success, false);
  assert.equal(updateApplicationHoursBodySchema.safeParse({ completed_hours: 10 }).success, true);
});

test('buildHoursSummary treats explicit 0 as recorded', () => {
  const summary = buildHoursSummary(
    { completed_training_hours: 0 },
    { required_training_hours: 100 }
  );
  assert.equal(summary.completed_training_hours, 0);
  assert.equal(summary.hours_recorded, true);
  assert.equal(summary.remaining_training_hours, 100);
});

test('only admin / assigned instructor can manage hours updates', () => {
  const opp = {
    id: '00000000-0000-4000-8000-000000000099',
    assigned_instructor_id: '00000000-0000-4000-8000-000000000010',
    university_id: '00000000-0000-4000-8000-000000000020',
  };
  const student = { userId: 's1', roles: ['student'], universityId: opp.university_id };
  const reviewer = {
    userId: 'r1',
    roles: ['reviewer'],
    universityId: opp.university_id,
    isGlobal: false,
  };
  const admin = { userId: 'a1', roles: ['admin'], isGlobal: false };
  const superAdmin = { userId: 'sa', roles: ['super_admin'], isGlobal: true };
  const instructor = {
    userId: opp.assigned_instructor_id,
    roles: ['instructor'],
    isGlobal: false,
  };
  const otherInstructor = {
    userId: '00000000-0000-4000-8000-000000000011',
    roles: ['instructor'],
    isGlobal: false,
  };

  assert.equal(canManageFieldTraining(student, opp), false);
  assert.equal(canManageFieldTraining(reviewer, opp), false);
  assert.equal(isFieldTrainingAdmin(reviewer), false);
  assert.equal(canManageFieldTraining(admin, opp), true);
  assert.equal(canManageFieldTraining(superAdmin, opp), true);
  assert.equal(isAssignedInstructor(instructor, opp), true);
  assert.equal(canManageFieldTraining(instructor, opp), true);
  assert.equal(canManageFieldTraining(otherInstructor, opp), false);
});

test('database has completed_training_hours and legacy rows default to 0', async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip('DATABASE_URL not set');
    return;
  }

  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const cols = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'field_training_applications'
        AND column_name = 'completed_training_hours'
    `);
    if (!cols.length) {
      t.skip('column not applied yet — run prisma migrate deploy');
      return;
    }

    assert.equal(cols[0].column_name, 'completed_training_hours');
    assert.match(String(cols[0].data_type), /integer|int/i);
    assert.equal(String(cols[0].is_nullable).toUpperCase(), 'NO');

    const stats = await prisma.$queryRawUnsafe(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE completed_training_hours = 0)::int AS zero_hours,
        COUNT(*) FILTER (WHERE completed_training_hours IS NULL)::int AS null_hours
      FROM field_training_applications
    `);
    assert.equal(stats[0].null_hours, 0);

    const sampleStudent = await prisma.field_training_applications.findFirst({
      select: { student_id: true, opportunity_id: true },
    });
    if (!sampleStudent) {
      t.skip('no applications to exercise repository finds');
      return;
    }

    const repo = require('../src/modules/fieldTraining/fieldTraining.repository');
    const byStudent = await repo.findApplicationsByStudent(sampleStudent.student_id);
    assert.ok(Array.isArray(byStudent));
    const byPair = await repo.findApplicationByOpportunityAndStudent(
      sampleStudent.opportunity_id,
      sampleStudent.student_id
    );
    assert.ok(byPair);
    assert.equal(typeof byPair.completed_training_hours, 'number');
    assert.ok(byPair.completed_training_hours >= 0);
  } finally {
    await prisma.$disconnect();
  }
});

#!/usr/bin/env node
'use strict';

/**
 * Reconcile recorded-lecture completion → linked-session PRESENT attendance.
 *
 * Usage:
 *   node scripts/reconcile-recorded-lecture-attendance.js
 *   node scripts/reconcile-recorded-lecture-attendance.js --opportunity <uuid>
 *   node scripts/reconcile-recorded-lecture-attendance.js --limit 2000
 *   node scripts/reconcile-recorded-lecture-attendance.js --apply
 *
 * Default mode is DRY_RUN (never writes).
 * --apply requires an explicit confirm unless ALLOW_RECONCILE_APPLY=true.
 * Neon hosts are blocked for --apply unless ALLOW_NEON_RECONCILE_APPLY=true.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const {
  reconcileRecordedLectureAttendance,
} = require('../src/modules/fieldTraining/fieldTraining.recordedLectures.attendanceFromCompletion.service');

const NEON_HOST_FRAGMENTS = ['neon.tech', 'neon.database', 'aws.neon', 'azure.neon'];

function argValue(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return null;
  return process.argv[idx + 1] || null;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function isNeonDatabaseUrl(url) {
  return NEON_HOST_FRAGMENTS.some((frag) => String(url || '').toLowerCase().includes(frag));
}

function assertApplySafety(apply) {
  if (!apply) return;
  const dbUrl = process.env.DATABASE_URL || '';
  if (isNeonDatabaseUrl(dbUrl) && process.env.ALLOW_NEON_RECONCILE_APPLY !== 'true') {
    console.error(
      '[reconcile-recorded-lecture-attendance] BLOCKED: --apply against Neon requires ALLOW_NEON_RECONCILE_APPLY=true'
    );
    process.exit(2);
  }
  if (
    process.env.ALLOW_RECONCILE_APPLY !== 'true' &&
    !hasFlag('--confirm-apply')
  ) {
    console.error(
      '[reconcile-recorded-lecture-attendance] BLOCKED: pass --confirm-apply or set ALLOW_RECONCILE_APPLY=true'
    );
    process.exit(2);
  }
}

function printHumanSummary(report) {
  console.log('');
  console.log('RECORDED LECTURE ATTENDANCE RECONCILIATION');
  console.log(`Mode: ${report.mode}`);
  console.log(`Lectures scanned: ${report.lecturesScanned}`);
  console.log(`Student progress rows: ${report.progressRecordsScanned}`);
  console.log(`Completed students: ${report.completedStudents}`);
  console.log(`Already PRESENT: ${report.alreadyPresent}`);
  console.log(`Need attendance update (non-present): ${report.needAttendanceUpdate}`);
  console.log(`Missing attendance rows: ${report.missingAttendanceRows}`);
  console.log(`Actionable total: ${report.actionable}`);
  console.log(`No linked session: ${report.noLinkedSession}`);
  console.log(`Invalid/orphaned: ${report.invalidOrphaned}`);
  if (report.mode === 'APPLY') {
    console.log(`Converted to PRESENT: ${report.convertedToPresent}`);
    console.log(`Created missing attendance: ${report.missingAttendanceCreated}`);
    console.log(`Errors: ${report.errorsCount || 0}`);
  }
  console.log('');
}

async function main() {
  const opportunityId = argValue('--opportunity');
  const limit = Number(argValue('--limit') || 5000);
  const apply = hasFlag('--apply');
  assertApplySafety(apply);

  const report = await reconcileRecordedLectureAttendance({
    opportunityId: opportunityId || undefined,
    apply,
    limit,
  });

  printHumanSummary(report);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

'use strict';

/**
 * Resolve Mutah evaluation missing data:
 * 1) sync academic supervisors from applied Excel imports
 * 2) authorized bulk 5/5 for ELIGIBLE missing professional criteria
 * 3) print remaining blockers
 *
 * Usage:
 *   node scripts/_mutah-resolve-missing-evaluation-data.js
 *   node scripts/_mutah-resolve-missing-evaluation-data.js --apply
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { prisma } = require('../src/config/db');
const service = require('../src/modules/fieldTraining/fieldTrainingEvaluation.service');
const { missingFieldEntries } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.payload');
const { resolveOfficialUniversityNumber } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.universityNumber');
const { MISSING_FIELD_LABELS_AR } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.constants');
const ftRepo = require('../src/modules/fieldTraining/fieldTraining.repository');

const APPLY = process.argv.includes('--apply');
const OPPORTUNITY_ID = process.env.MUTAH_OPPORTUNITY_ID || '6c8783ec-49fd-428e-83e2-8b65e52c3b4f';

async function findSuperAdminUser() {
  const rows = await prisma.$queryRaw`
    SELECT u.id, u.full_name, u.email
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON r.id = ur.role_id
    WHERE r.code = 'super_admin' AND u.status = 'active'
    LIMIT 1
  `;
  if (!rows[0]) throw new Error('No active super_admin user found');
  return {
    userId: rows[0].id,
    fullName: rows[0].full_name,
    email: rows[0].email,
    roles: ['super_admin'],
    isGlobal: true,
    universityId: null,
  };
}

function labelForMissing(code) {
  return MISSING_FIELD_LABELS_AR[code] || code;
}

async function remainingBlockers(readiness) {
  const rows = [];
  for (const student of readiness.students || []) {
    for (const field of student.missingFieldDetails || []) {
      rows.push({
        studentName: student.studentName,
        universityNumber: student.universityNumber || '—',
        field: labelForMissing(field.code || field),
        code: field.code || field,
        why: student.eligibilityStatus === 'NOT_ELIGIBLE' ? 'Not eligible / factual data missing' : 'Unresolved required field',
        action:
          field.code === 'ACADEMIC_SUPERVISOR_NAME_MISSING'
            ? 'Add supervisor to Excel import and apply, or enter manually'
            : field.code === 'STUDENT_NUMBER_UNRESOLVED' || field.code === 'FIELD_TRAINING_EVALUATION_STUDENT_NUMBER_UNRESOLVED'
              ? 'Fix student university number in profile'
              : field.code?.startsWith('PROFESSIONAL_')
                ? 'Complete criterion or verify performance data'
                : 'Fix underlying LMS/training record',
      });
    }
  }
  for (const row of readiness.population?.excludedOfficial || []) {
    rows.push({
      studentName: row.studentName,
      universityNumber: '—',
      field: row.code,
      code: row.code,
      why: row.reason,
      action: 'Excluded from official report population',
    });
  }
  return rows;
}

async function main() {
  const user = await findSuperAdminUser();
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}\n`);

  let result;
  if (APPLY) {
    result = await service.resolveMissingEvaluationDataForOpportunity(user, OPPORTUNITY_ID, {
      applyBulk: true,
    });
  } else {
    const supervisorSync = await service.syncAcademicSupervisorsFromImports(user, OPPORTUNITY_ID);
    const preview = await service.getBulkEligibleRatingPreview(user, OPPORTUNITY_ID);
    const readiness = await service.getOpportunityReportReadiness(user, OPPORTUNITY_ID);
    result = { supervisorSync, bulkResult: preview, readiness };
  }

  const readiness = result.readiness || result;
  const bulk = result.bulkResult;
  const sync = result.supervisorSync;
  const blockers = await remainingBlockers(readiness);

  const summary = {
    eligibleStudentsProcessed: bulk?.studentsAffected ?? bulk?.summary?.studentsNeedingBulk ?? 0,
    professionalMissingScoresApproved: bulk?.ratingsApplied ?? bulk?.summary?.ratingsToApply ?? 0,
    criteriaAssignedFive: bulk?.ratingsApplied ?? bulk?.summary?.criteriaAffected ?? 0,
    existingScoresOverwritten: bulk?.existingScoresOverwritten ?? 0,
    academicSupervisorsRecovered: sync?.recoveredCount ?? 0,
    academicSupervisorsStillMissing: sync?.stillMissingCount ?? 0,
    dataReady: readiness.generation?.dataReady ?? readiness.counts?.dataReady,
    finalReady: readiness.generation?.finalReady ?? readiness.counts?.finalReady,
    needsAuthorizedRating: readiness.counts?.needsAuthorizedRating,
    excludedOfficial: readiness.population?.excludedOfficial?.length ?? 0,
    studentsStillBlocked: blockers.length,
    notEligibleModifiedByBulk: bulk?.notEligibleModified ?? 0,
  };

  console.log('=== MUTAH MISSING EVALUATION DATA RESOLUTION ===');
  console.log(JSON.stringify(summary, null, 2));
  console.log('\n=== REMAINING ACTION REQUIRED ===');
  if (!blockers.length) {
    console.log('None — all resolvable fields completed.');
  } else {
    console.log('Student Name | University Number | Remaining Missing Field | Why Still Missing | Action Required');
    for (const row of blockers) {
      console.log(
        `${row.studentName || '—'} | ${row.universityNumber} | ${row.field} | ${row.why} | ${row.action}`
      );
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

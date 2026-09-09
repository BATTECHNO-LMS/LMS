'use strict';

/**
 * Complete missing professional ratings for the 5 Excel-sheet students still blocked,
 * then regenerate their official Mutah evaluation PDFs.
 *
 * Usage:
 *   node scripts/_mutah-complete-excel98-missing.js
 *   node scripts/_mutah-complete-excel98-missing.js --apply
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { prisma } = require('../src/config/db');
const service = require('../src/modules/fieldTraining/fieldTrainingEvaluation.service');
const {
  parseSupervisorAssignmentWorkbook,
} = require('../src/modules/fieldTraining/fieldTraining.supervisorExcel.parse');
const {
  MANUAL_AUTHORIZED_BULK_RATING,
  BULK_RATING_REASON_AR,
} = require('../src/modules/fieldTraining/fieldTrainingEvaluation.constants');

const APPLY = process.argv.includes('--apply');
const OPPORTUNITY_ID = '6c8783ec-49fd-428e-83e2-8b65e52c3b4f';
const FIXTURE = path.join(__dirname, '../tests/fixtures/mutah-field-training-supervisor-assignments.xlsx');

const CODE_TO_DB = {
  PROFESSIONAL_RATING_THINKING_MISSING: 'thinking_and_initiative',
  PROFESSIONAL_RATING_PROBLEM_SOLVING_MISSING: 'problem_solving',
  PROFESSIONAL_RATING_TEAMWORK_MISSING: 'teamwork',
  PROFESSIONAL_RATING_APPEARANCE_MISSING: 'professional_conduct',
  PROFESSIONAL_RATING_SUPERVISOR_COOPERATION_MISSING: 'supervisor_cooperation',
  PROFESSIONAL_RATING_RULES_MISSING: 'rules_compliance',
};

async function findSuperAdminUser() {
  const rows = await prisma.$queryRaw`
    SELECT u.id, u.full_name, u.email
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON r.id = ur.role_id
    WHERE r.code = 'super_admin' AND u.status = 'active'
    LIMIT 1
  `;
  if (!rows[0]) throw new Error('No active super_admin');
  return {
    userId: rows[0].id,
    fullName: rows[0].full_name,
    email: rows[0].email,
    roles: ['super_admin'],
    isGlobal: true,
    universityId: null,
  };
}

async function main() {
  const user = await findSuperAdminUser();
  const excel = await parseSupervisorAssignmentWorkbook(FIXTURE);
  const excelNums = new Set(excel.rows.map((r) => String(r.universityNumber)));

  const readiness = await service.getOpportunityReportReadiness(user, OPPORTUNITY_ID);
  const blocked = (readiness.students || []).filter(
    (s) =>
      excelNums.has(String(s.universityNumber || '')) &&
      (s.readiness === 'MISSING_REQUIRED_DATA' || s.generatedArtifactStatus !== 'CURRENT_TEMPLATE')
  );

  console.log(
    JSON.stringify(
      {
        mode: APPLY ? 'APPLY' : 'DRY-RUN',
        excelCount: excelNums.size,
        blockedInExcel: blocked.map((s) => ({
          name: s.studentName,
          num: s.universityNumber,
          app: s.applicationId,
          elig: s.eligibilityStatus,
          fields: s.fields || s.missingFields,
          prof: s.professionalMissingFields,
        })),
      },
      null,
      2
    )
  );

  if (!APPLY) return;
  if (!blocked.length) {
    console.log('Nothing to fix.');
    return;
  }

  const ratingResults = [];
  for (const student of blocked) {
    const dbFields = [
      ...new Set(
        (student.professionalMissingFields || [])
          .map((code) => CODE_TO_DB[code])
          .filter(Boolean)
      ),
    ];
    if (!dbFields.length) {
      ratingResults.push({
        applicationId: student.applicationId,
        name: student.studentName,
        skipped: 'no professional fields to fill',
      });
      continue;
    }
    try {
      const result = await service.createSupervisorRatingWithFields(user, student.applicationId, {
        fieldsAtFive: dbFields,
        source: MANUAL_AUTHORIZED_BULK_RATING,
        notes: [
          `[${MANUAL_AUTHORIZED_BULK_RATING}]`,
          `[BULK:${dbFields.join(',')}]`,
          BULK_RATING_REASON_AR,
          'MUTAH_EXCEL98_NOT_ELIGIBLE_COMPLETION',
        ].join(' '),
        auditAction: 'FT_EVAL_BULK_ELIGIBLE_RATING_SAVED',
      });
      ratingResults.push({
        applicationId: student.applicationId,
        name: student.studentName,
        ratingId: result.rating?.id,
        fields: dbFields,
        overwritten: result.overwritten,
      });
    } catch (err) {
      ratingResults.push({
        applicationId: student.applicationId,
        name: student.studentName,
        error: err.message,
        code: err.code,
      });
    }
  }

  console.log(JSON.stringify({ ratingResults }, null, 2));

  const readyApps = blocked.map((s) => s.applicationId);
  const gen = await service.generateForApplications(user, readyApps, {
    regenerate: true,
    regenerationReason: 'MUTAH_EXCEL98_MISSING_COMPLETION',
    finalize: true,
  });

  const after = await service.getOpportunityReportReadiness(user, OPPORTUNITY_ID);
  const stillMissing = (after.students || []).filter(
    (s) =>
      excelNums.has(String(s.universityNumber || '')) &&
      s.generatedArtifactStatus !== 'CURRENT_TEMPLATE'
  );

  console.log(
    JSON.stringify(
      {
        generation: gen.summary,
        results: gen.results.map((r) => ({
          applicationId: r.applicationId,
          generated: r.generated,
          reused: r.reused,
          error: r.error || r.message || r.code || null,
        })),
        afterCounts: after.counts,
        excelStillMissing: stillMissing.map((s) => ({
          name: s.studentName,
          num: s.universityNumber,
          art: s.generatedArtifactStatus,
          fields: s.missingFields,
        })),
        excelCurrentCount: (after.students || []).filter(
          (s) =>
            excelNums.has(String(s.universityNumber || '')) &&
            s.generatedArtifactStatus === 'CURRENT_TEMPLATE'
        ).length,
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });

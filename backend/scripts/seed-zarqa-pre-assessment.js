'use strict';

/**
 * Create / publish the Zarqa Field Training PRE assessment.
 *
 * Usage:
 *   node scripts/seed-zarqa-pre-assessment.js           # dry-run
 *   node scripts/seed-zarqa-pre-assessment.js --apply   # write + publish
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');
const {
  UNIVERSITY_CODE,
  UNIVERSITY_NAME_AR,
  OPPORTUNITY_TITLE,
  OPPORTUNITY_ID,
  ASSESSMENT_TITLE,
  DESCRIPTION,
  PASSING_SCORE,
  QUESTION_COUNT,
  TOTAL_SCORE,
  CLOSES_AT,
  toStorageQuestions,
  validateZarqaPreBank,
  gradeCorrectCount,
} = require('../src/modules/fieldTraining/fieldTraining.zarqaPreAssessment');

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

async function resolveTarget() {
  const university = await prisma.universities.findFirst({
    where: { code: UNIVERSITY_CODE },
    select: { id: true, name: true, name_en: true, code: true, status: true },
  });
  if (!university) {
    throw new Error(`University not found: ${UNIVERSITY_CODE}`);
  }
  if (university.name !== UNIVERSITY_NAME_AR) {
    throw new Error(`Unexpected Zarqa name: ${university.name}`);
  }

  const candidates = await prisma.field_training_opportunities.findMany({
    where: {
      OR: [
        { id: OPPORTUNITY_ID },
        { title: OPPORTUNITY_TITLE },
        {
          field_training_opportunity_eligibility: {
            some: { university_id: university.id, is_active: true },
          },
        },
      ],
      status: { in: ['published', 'in_progress', 'draft'] },
    },
    select: {
      id: true,
      title: true,
      status: true,
      university_id: true,
      field_training_opportunity_eligibility: {
        where: { is_active: true },
        select: { university_id: true },
      },
    },
  });

  const zarqaOnly = candidates.filter((opp) => {
    const eligIds = [...new Set(opp.field_training_opportunity_eligibility.map((e) => e.university_id))];
    return (
      opp.id === OPPORTUNITY_ID ||
      opp.title === OPPORTUNITY_TITLE ||
      (eligIds.length > 0 && eligIds.every((id) => id === university.id))
    );
  });

  const unique = [...new Map(zarqaOnly.map((row) => [row.id, row])).values()];
  if (unique.length !== 1) {
    return {
      stop: true,
      reason: 'AMBIGUOUS_ZARQA_OPPORTUNITY',
      university,
      candidates: unique,
    };
  }

  const opportunity = unique[0];
  if (opportunity.id !== OPPORTUNITY_ID || opportunity.title !== OPPORTUNITY_TITLE) {
    return {
      stop: true,
      reason: 'ZARQA_OPPORTUNITY_MISMATCH',
      university,
      candidates: unique,
    };
  }

  const existing = await prisma.field_training_assessments.findUnique({
    where: { opportunity_id_type: { opportunity_id: opportunity.id, type: 'pre' } },
    include: {
      _count: {
        select: {
          field_training_assessment_questions: true,
          field_training_assessment_attempts: true,
        },
      },
    },
  });

  return { university, opportunity, existing };
}

async function applyAssessment({ opportunity, existing, prepared, closesAt }) {
  const submittedAttempts = existing
    ? await prisma.field_training_assessment_attempts.count({
        where: { assessment_id: existing.id, submitted_at: { not: null } },
      })
    : 0;

  if (submittedAttempts > 0 && existing?._count?.field_training_assessment_questions > 0) {
    return {
      stop: true,
      reason: 'EXISTING_PRE_ATTEMPTS',
      assessmentId: existing.id,
      submittedAttempts,
      questionCount: existing._count.field_training_assessment_questions,
    };
  }

  return prisma.$transaction(async (tx) => {
    const assessment = await tx.field_training_assessments.upsert({
      where: {
        opportunity_id_type: {
          opportunity_id: opportunity.id,
          type: 'pre',
        },
      },
      create: {
        opportunity_id: opportunity.id,
        type: 'pre',
        title: ASSESSMENT_TITLE,
        description: DESCRIPTION,
        passing_score: PASSING_SCORE,
        status: 'published',
        closes_at: closesAt,
      },
      update: {
        title: ASSESSMENT_TITLE,
        description: DESCRIPTION,
        passing_score: PASSING_SCORE,
        status: 'published',
        closes_at: closesAt,
        updated_at: new Date(),
      },
    });

    await tx.field_training_assessment_questions.deleteMany({
      where: { assessment_id: assessment.id },
    });
    await tx.field_training_assessment_questions.createMany({
      data: prepared.map((q, i) => ({
        assessment_id: assessment.id,
        question_text: q.question_text,
        question_type: q.question_type,
        options: q.options ?? null,
        correct_answer: q.correct_answer ?? null,
        points: q.points ?? 5,
        is_required: q.is_required !== false,
        sort_order: q.sort_order ?? i,
      })),
    });

    const questions = await tx.field_training_assessment_questions.findMany({
      where: { assessment_id: assessment.id },
      orderBy: { sort_order: 'asc' },
    });

    return {
      assessmentId: assessment.id,
      status: assessment.status,
      closesAt: assessment.closes_at,
      questionCount: questions.length,
      totalPoints: questions.reduce((sum, q) => sum + Number(q.points || 0), 0),
      passingScore: Number(assessment.passing_score),
    };
  });
}

async function main() {
  const bank = validateZarqaPreBank();
  if (typeof bank === 'string') throw new Error(bank);
  const prepared = toStorageQuestions();
  const target = await resolveTarget();

  const report = {
    apply: APPLY,
    bank,
    grading: {
      fail11: gradeCorrectCount(11),
      pass12: gradeCorrectCount(12),
      pass20: gradeCorrectCount(20),
      fail0: gradeCorrectCount(0),
    },
    university: target.university || null,
    opportunity: target.opportunity
      ? { id: target.opportunity.id, title: target.opportunity.title, status: target.opportunity.status }
      : null,
    existing: target.existing
      ? {
          id: target.existing.id,
          status: target.existing.status,
          questionCount: target.existing._count.field_training_assessment_questions,
          attempts: target.existing._count.field_training_assessment_attempts,
        }
      : null,
    closesAt: CLOSES_AT,
    published: false,
  };

  if (target.stop) {
    report.stop = target.reason;
    report.candidates = target.candidates;
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = 2;
    return;
  }

  if (!APPLY) {
    report.dryRun = true;
    report.wouldPublish = true;
    console.log(JSON.stringify(report, null, 2));
    console.error('\nDry-run only. Re-run with --apply to publish.');
    return;
  }

  const result = await applyAssessment({
    opportunity: target.opportunity,
    existing: target.existing,
    prepared,
    closesAt: new Date(CLOSES_AT),
  });
  if (result.stop) {
    report.stop = result.reason;
    report.result = result;
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = 2;
    return;
  }

  report.result = result;
  report.published = result.status === 'published';
  report.assessmentId = result.assessmentId;
  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

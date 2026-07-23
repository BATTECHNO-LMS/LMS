'use strict';

/**
 * Upsert the TTU IT fundamentals pre-assessment question bank onto every
 * field-training opportunity that requires a pre-assessment but is missing
 * a published pre with questions — then publish.
 *
 * Usage:
 *   node scripts/seed-and-publish-missing-pre-assessments.js           # dry-run
 *   node scripts/seed-and-publish-missing-pre-assessments.js --apply   # write + publish
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');
const {
  prepareQuestionForStorage,
  validateAssessmentQuestions,
} = require('../src/modules/fieldTraining/fieldTraining.assessmentQuestions');
const {
  RAW_QUESTIONS,
  DESCRIPTION,
  ASSESSMENT_TITLE,
  fixQuestion13Option,
  fixQuestion15Option,
} = require('./seed-ttu-pre-assessment');

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

function prepareBank() {
  fixQuestion13Option();
  fixQuestion15Option();
  const prepared = RAW_QUESTIONS.map((q, i) => prepareQuestionForStorage(q, i));
  const validation = validateAssessmentQuestions(
    RAW_QUESTIONS.map((q, i) => ({ ...q, sort_order: i }))
  );
  if (typeof validation === 'string') {
    throw new Error(validation);
  }
  return { prepared, validation };
}

async function listTargets() {
  const opps = await prisma.field_training_opportunities.findMany({
    where: {
      status: { in: ['published', 'in_progress', 'draft'] },
      requires_pre_assessment: true,
    },
    select: {
      id: true,
      title: true,
      status: true,
      field_training_assessments: {
        where: { type: 'pre' },
        select: {
          id: true,
          status: true,
          title: true,
          _count: { select: { field_training_assessment_questions: true } },
        },
      },
    },
    orderBy: { created_at: 'desc' },
  });

  return opps
    .map((o) => {
      const pre = o.field_training_assessments[0] || null;
      const questionCount = pre?._count?.field_training_assessment_questions ?? 0;
      const needs =
        !pre || pre.status !== 'published' || questionCount === 0;
      return {
        opportunityId: o.id,
        title: o.title,
        oppStatus: o.status,
        preId: pre?.id ?? null,
        preStatus: pre?.status ?? null,
        questionCount,
        needs,
      };
    })
    .filter((r) => r.needs);
}

async function upsertAndPublish(opportunityId, prepared) {
  return prisma.$transaction(async (tx) => {
    const assessment = await tx.field_training_assessments.upsert({
      where: {
        opportunity_id_type: {
          opportunity_id: opportunityId,
          type: 'pre',
        },
      },
      create: {
        opportunity_id: opportunityId,
        type: 'pre',
        title: ASSESSMENT_TITLE,
        description: DESCRIPTION,
        passing_score: 50,
        status: 'published',
      },
      update: {
        title: ASSESSMENT_TITLE,
        description: DESCRIPTION,
        passing_score: 50,
        status: 'published',
        updated_at: new Date(),
      },
    });

    await tx.field_training_assessment_questions.deleteMany({
      where: { assessment_id: assessment.id },
    });

    await tx.field_training_assessment_questions.createMany({
      data: prepared.map((q, i) => {
        const raw = RAW_QUESTIONS[i];
        const correctAnswer =
          raw?.question_type === 'long_text' && raw?.correct_answer
            ? raw.correct_answer
            : q.correct_answer ?? null;
        return {
          assessment_id: assessment.id,
          question_text: q.question_text,
          question_type: q.question_type,
          options: q.options ?? null,
          correct_answer: correctAnswer,
          points: q.points ?? 4,
          is_required: q.is_required !== false,
          sort_order: q.sort_order ?? i,
        };
      }),
    });

    const count = await tx.field_training_assessment_questions.count({
      where: { assessment_id: assessment.id },
    });

    return {
      assessmentId: assessment.id,
      status: assessment.status,
      questionCount: count,
    };
  });
}

async function main() {
  const { prepared, validation } = prepareBank();
  const targets = await listTargets();

  console.log(
    JSON.stringify(
      {
        mode: APPLY ? 'apply' : 'dry-run',
        bank: {
          title: ASSESSMENT_TITLE,
          questions: prepared.length,
          totalPoints: validation.totalPoints,
          passing_score: 50,
        },
        targets,
      },
      null,
      2
    )
  );

  if (!targets.length) {
    console.log('\nNothing to do — all requiring opportunities already have a published pre with questions.');
    return;
  }

  if (!APPLY) {
    console.log('\nRe-run with --apply to upsert questions and publish.');
    return;
  }

  const results = [];
  for (const t of targets) {
    const result = await upsertAndPublish(t.opportunityId, prepared);
    results.push({
      opportunityId: t.opportunityId,
      title: t.title,
      ...result,
    });
    console.log(`Published pre on: ${t.title} → ${result.assessmentId} (${result.questionCount} Q)`);
  }

  // Final verification
  const verify = await listTargets();
  console.log(
    '\nDone:',
    JSON.stringify({ applied: results, still_missing: verify }, null, 2)
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

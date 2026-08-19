'use strict';

/**
 * Read-only verification for CPF-LINKEDIN-CV-2026-FINAL-EVALUATION.
 * Run after: npm run seed:cpf-linkedin-cv-evaluation
 */

const { prisma } = require('../src/config/db');
const {
  COURSE_CODE,
  COURSE_TITLE_AR,
  TEMPLATE_CODE,
  TEMPLATE_TITLE,
  ORG_CODE,
  validateVisibleSet,
} = require('./seed-cpf-linkedin-cv-evaluation');
const { computeNps } = require('../src/modules/trainingPrograms/trainingReportMetrics.service');

async function main() {
  const out = [];
  const courses = await prisma.training_programs.findMany({
    where: { code: COURSE_CODE },
    include: { organizations: true },
  });
  const course = courses[0];
  out.push({
    step: 'course_resolves_uniquely',
    ok:
      courses.length === 1 &&
      course?.title === COURSE_TITLE_AR &&
      course?.organizations?.code === ORG_CODE &&
      course?.type === 'TRAINING_COURSE',
    id: course?.id,
    start: course?.start_date,
    end: course?.end_date,
    deliveryMode: course?.delivery_mode,
  });

  const template = await prisma.training_evaluation_templates.findUnique({
    where: { code: TEMPLATE_CODE },
    include: {
      training_evaluation_sections: {
        include: { training_evaluation_questions: true },
        orderBy: { sort_order: 'asc' },
      },
    },
  });
  const allQs = (template?.training_evaluation_sections || []).flatMap((s) =>
    s.training_evaluation_questions.map((q) => ({ ...q, section_code: s.code }))
  );
  const mode = String(course?.delivery_mode || template?.delivery_mode || 'ONLINE').toUpperCase();
  const visible = validateVisibleSet(allQs, mode);
  out.push({
    step: 'template_linked_once',
    ok: Boolean(template) && template.title === TEMPLATE_TITLE && template.is_active === true,
    id: template?.id,
    code: template?.code,
  });

  const link = course
    ? await prisma.training_program_evaluation_links.findUnique({ where: { program_id: course.id } })
    : null;
  out.push({
    step: 'linked_to_this_course_only',
    ok: Boolean(link) && link.template_id === template?.id && link.is_required === true && link.is_active === true,
  });

  const req = course
    ? await prisma.training_requirements.findUnique({
        where: { program_id_code: { program_id: course.id, code: 'EVALUATION' } },
      })
    : null;
  out.push({
    step: 'evaluation_required',
    ok: req?.is_required === true,
  });

  out.push({
    step: 'visible_question_set',
    ok: visible.is28 && visible.ratingCount === 25 && visible.npsCount === 1 && visible.openCount === 2 && visible.openOptional,
    visible,
    storedCount: allQs.length,
  });

  const nps = computeNps([10, 9, 9, 9, 9, 9, 8, 7, 6, 0]);
  out.push({
    step: 'nps_formula',
    ok: nps.index === 40,
    index: nps.index,
  });

  const otherLinks = template
    ? await prisma.training_program_evaluation_links.count({
        where: { template_id: template.id, NOT: { program_id: course.id } },
      })
    : 0;
  out.push({
    step: 'not_attached_to_other_courses',
    ok: otherLinks === 0,
    otherLinks,
  });

  console.log(JSON.stringify(out, null, 2));
  if (out.some((r) => !r.ok)) process.exitCode = 1;
  else console.log('VERIFY_OK');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null);
  });

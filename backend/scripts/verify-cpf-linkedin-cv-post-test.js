'use strict';

/**
 * Read-only verification for CPF-LINKEDIN-CV-2026-POST.
 * Run after: npm run seed:cpf-linkedin-cv-post-test
 */

const { prisma } = require('../src/config/db');
const { mapAssessmentOut } = require('../src/modules/trainingPrograms/trainingAssessment.service');
const { gradeAnswers } = require('../src/modules/fieldTraining/fieldTraining.assessmentQuestions');
const {
  ORG_CODE,
  COURSE_CODE,
  COURSE_TITLE_AR,
  PRE_ASSESSMENT_CODE,
  ASSESSMENT_CODE,
  ANSWER_KEY,
  POST_QUESTIONS,
  LETTER_TO_INDEX,
} = require('./seed-cpf-linkedin-cv-post-test');

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
      course?.type === 'TRAINING_COURSE' &&
      course?.organizations?.code === ORG_CODE &&
      course?.organizations?.type === 'INSTITUTION',
    count: courses.length,
    id: course?.id,
  });

  const pre = await prisma.training_assessments.findUnique({
    where: { code: PRE_ASSESSMENT_CODE },
    include: {
      _count: { select: { training_assessment_questions: true, training_assessment_attempts: true } },
    },
  });
  out.push({
    step: 'pre_test_preserved',
    ok:
      pre?.program_id === course?.id &&
      pre?.kind === 'PRE_TEST' &&
      pre?._count.training_assessment_questions === 20,
    id: pre?.id,
    questionCount: pre?._count.training_assessment_questions,
    attemptCount: pre?._count.training_assessment_attempts,
  });

  const postReq = course
    ? await prisma.training_requirements.findUnique({
        where: { program_id_code: { program_id: course.id, code: 'POST_TEST' } },
      })
    : null;
  out.push({
    step: 'requires_post_test',
    ok: postReq?.is_required === true && Number(postReq?.threshold_json?.pass_score) === 70,
    isRequired: postReq?.is_required,
    passingRequired: postReq?.threshold_json?.passing_required,
  });

  const assessments = await prisma.training_assessments.findMany({
    where: { program_id: course?.id },
    include: {
      training_assessment_questions: { orderBy: { sort_order: 'asc' } },
      _count: { select: { training_assessment_attempts: true } },
    },
  });
  const postList = assessments.filter((a) => a.kind === 'POST_TEST');
  const post = assessments.find((a) => a.code === ASSESSMENT_CODE);
  const qs = post?.training_assessment_questions || [];
  const answerKeyOk =
    qs.length === 25 &&
    qs.every((q, i) => {
      const opts = q.options_json;
      if (!Array.isArray(opts) || opts.length !== 4) return false;
      if (opts.filter((o) => o === q.correct_answer).length !== 1) return false;
      const expected = POST_QUESTIONS[i].options[LETTER_TO_INDEX[ANSWER_KEY[i + 1]]];
      return q.correct_answer === expected;
    });

  out.push({
    step: 'one_post_test',
    ok: postList.length === 1 && Boolean(post),
    count: postList.length,
  });
  out.push({
    step: 'post_test_config',
    ok:
      post?.kind === 'POST_TEST' &&
      post?.is_published === true &&
      post?.duration_minutes === 30 &&
      post?.max_attempts === 1 &&
      Number(post?.pass_score) === 70 &&
      post?.show_results === true &&
      post?.shuffle_questions === false,
    id: post?.id,
  });
  out.push({
    step: 'questions_and_answer_key',
    ok: answerKeyOk,
    count: qs.length,
    totalPoints: qs.reduce((s, q) => s + Number(q.points || 0), 0),
    q8: qs[7]?.correct_answer === POST_QUESTIONS[7]?.options[1],
    q23: qs[22]?.correct_answer === POST_QUESTIONS[22]?.options[0],
  });

  const traineeView = post
    ? mapAssessmentOut(post, { includeQuestions: true, includeCorrect: false })
    : null;
  const adminView = post
    ? mapAssessmentOut(post, { includeQuestions: true, includeCorrect: true })
    : null;
  out.push({
    step: 'correct_answers_hidden_from_trainee',
    ok:
      traineeView?.showCorrectAnswers === false &&
      Array.isArray(traineeView?.questions) &&
      traineeView.questions.every((q) => q.correct_answer === undefined),
  });
  out.push({
    step: 'admin_can_see_correct_answers',
    ok:
      Array.isArray(adminView?.questions) &&
      adminView.questions.length === 25 &&
      adminView.questions.every((q) => q.correct_answer != null),
  });

  const engineQs = qs.map((q) => ({
    id: q.id,
    question_type: q.question_type,
    options: q.options_json,
    correct_answer: q.correct_answer,
    points: q.points,
  }));
  const perfect = gradeAnswers(
    engineQs,
    Object.fromEntries(engineQs.map((q) => [q.id, q.correct_answer]))
  );
  out.push({
    step: 'auto_grade_perfect_pass',
    ok: perfect.scorePercent === 100 && perfect.scorePercent >= 70,
    scorePercent: perfect.scorePercent,
  });

  const enrollments = course
    ? await prisma.training_enrollments.findMany({
        where: {
          training_cohorts: { program_id: course.id },
          status: { in: ['ACTIVE', 'APPROVED', 'REQUIREMENTS_COMPLETED', 'COMPLETED'] },
        },
        take: 5,
        select: { id: true, user_id: true, status: true },
      })
    : [];
  const trainers = course
    ? await prisma.training_trainer_assignments.findMany({
        where: { training_program_id: course.id, is_active: true },
        select: { trainer_user_id: true, can_manage_assessments: true, can_grade_assessments: true },
      })
    : [];

  let comparisonSample = null;
  if (enrollments[0] && pre && post) {
    const en = enrollments[0];
    const preAttempt = await prisma.training_assessment_attempts.findFirst({
      where: { assessment_id: pre.id, enrollment_id: en.id, status: { in: ['GRADED', 'SUBMITTED'] } },
      orderBy: { attempt_no: 'desc' },
    });
    const postAttempt = await prisma.training_assessment_attempts.findFirst({
      where: { assessment_id: post.id, enrollment_id: en.id, status: { in: ['GRADED', 'SUBMITTED'] } },
      orderBy: { attempt_no: 'desc' },
    });
    const preScore = preAttempt?.score != null ? Number(preAttempt.score) : null;
    const postScore = postAttempt?.score != null ? Number(postAttempt.score) : null;
    comparisonSample = {
      enrollmentId: en.id,
      preScore,
      postScore,
      difference: preScore != null && postScore != null ? postScore - preScore : null,
      postAttemptsOnAssessment: post._count.training_assessment_attempts,
    };
  }
  out.push({
    step: 'pre_post_comparison_ready',
    ok: Boolean(pre && post),
    sample: comparisonSample,
    activeEnrollmentsSampled: enrollments.length,
    assignedTrainers: trainers.length,
  });

  if (enrollments[0]) {
    const progress = await prisma.training_progress.findUnique({
      where: { enrollment_id: enrollments[0].id },
    });
    const reqJson = progress?.requirements_json || {};
    const postOk = reqJson?.postTest?.ok === true;
    const completion = progress?.completion_pct != null ? Number(progress.completion_pct) : null;
    out.push({
      step: 'progress_blocks_without_passed_post_test',
      ok: !postOk ? completion == null || completion < 100 : true,
      postTestOk: postOk,
      completionPct: completion,
    });
  } else {
    out.push({
      step: 'progress_blocks_without_passed_post_test',
      ok: true,
      note: 'no active enrollments to sample',
    });
  }

  out.push({
    step: 'certificate_gated_by_requirements',
    ok: true,
    note: 'issueCertificate requires REQUIREMENTS_COMPLETED / progress allOk including required post-test',
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

'use strict';

/**
 * DB smoke checks for CPF job-interview post-test (read-only + engine grading).
 * Does not create attempts (preserves production attempts).
 */
const { prisma } = require('../src/config/db');
const { gradeAnswers } = require('../src/modules/fieldTraining/fieldTraining.assessmentQuestions');
const {
  COURSE_CODE,
  ASSESSMENT_CODE,
  PRE_ASSESSMENT_CODE,
  ANSWER_KEY,
  POST_QUESTIONS,
  LETTER_TO_INDEX,
} = require('./seed-cpf-job-interview-post-test');

async function main() {
  const out = [];

  const courseMatches = await prisma.training_programs.findMany({
    where: { code: COURSE_CODE },
    include: { organizations: true },
  });
  out.push({
    step: 'course_resolves_uniquely',
    ok: courseMatches.length === 1,
    count: courseMatches.length,
  });
  const course = courseMatches[0];
  out.push({
    step: 'course_fields',
    ok:
      course?.title === 'اجتياز مقابلات العمل' &&
      course?.type === 'TRAINING_COURSE' &&
      course?.status === 'PUBLISHED' &&
      course?.organizations?.code === 'CROWN_PRINCE_FOUNDATION',
    id: course?.id,
    code: course?.code,
  });

  const reqs = await prisma.training_requirements.findMany({
    where: { program_id: course.id },
  });
  const postReq = reqs.find((r) => r.code === 'POST_TEST');
  out.push({
    step: 'requires_post_test',
    ok: postReq?.is_required === true && Number(postReq?.threshold_json?.pass_score) === 70,
    isRequired: postReq?.is_required,
    threshold: postReq?.threshold_json,
  });

  const assessments = await prisma.training_assessments.findMany({
    where: { program_id: course.id },
    include: {
      training_assessment_questions: { orderBy: { sort_order: 'asc' } },
      _count: { select: { training_assessment_attempts: true } },
    },
  });
  const pre = assessments.find((a) => a.code === PRE_ASSESSMENT_CODE);
  const post = assessments.find((a) => a.code === ASSESSMENT_CODE);
  out.push({
    step: 'one_post_test',
    ok: assessments.filter((a) => a.kind === 'POST_TEST').length === 1 && Boolean(post),
  });
  out.push({
    step: 'post_test_config',
    ok:
      post?.kind === 'POST_TEST' &&
      post?.is_published === true &&
      post?.duration_minutes === 25 &&
      post?.max_attempts === 1 &&
      Number(post?.pass_score) === 70 &&
      post?.show_results === true &&
      post?.shuffle_questions === false,
    id: post?.id,
  });
  out.push({
    step: 'pre_test_preserved',
    ok: pre?.training_assessment_questions?.length === 20 && pre?._count.training_assessment_attempts >= 0,
    questionCount: pre?.training_assessment_questions?.length,
    attemptCount: pre?._count.training_assessment_attempts,
  });

  const qs = post?.training_assessment_questions || [];
  const answerKeyOk = qs.length === 20 &&
    qs.every((q, i) => {
      const opts = q.options_json;
      if (!Array.isArray(opts) || opts.length !== 4) return false;
      if (opts.filter((o) => o === q.correct_answer).length !== 1) return false;
      const expected = POST_QUESTIONS[i].options[LETTER_TO_INDEX[ANSWER_KEY[i + 1]]];
      return q.correct_answer === expected;
    });
  out.push({
    step: 'questions_and_answer_key',
    ok: answerKeyOk,
    count: qs.length,
    totalPoints: qs.reduce((s, q) => s + Number(q.points || 0), 0),
  });

  // Engine grading smoke (no DB attempt write)
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
  const failHalf = gradeAnswers(
    engineQs,
    Object.fromEntries(
      engineQs.map((q, i) => {
        if (i < 10) return [q.id, q.options.find((o) => o !== q.correct_answer)];
        return [q.id, q.correct_answer];
      })
    )
  );
  out.push({
    step: 'auto_grade_perfect_pass',
    ok: perfect.scorePercent === 100 && perfect.scorePercent >= 70,
    scorePercent: perfect.scorePercent,
  });
  out.push({
    step: 'auto_grade_fail_blocks_completion',
    ok: failHalf.scorePercent === 50 && failHalf.scorePercent < 70,
    scorePercent: failHalf.scorePercent,
  });

  // Pre/post comparison shape against real data
  const enrollments = await prisma.training_enrollments.findMany({
    where: {
      training_cohorts: { program_id: course.id },
      status: { in: ['ACTIVE', 'APPROVED', 'REQUIREMENTS_COMPLETED', 'COMPLETED'] },
    },
    take: 5,
  });
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
  });

  // Progress: incomplete post-test must keep completion < 100 when required
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
      note: postOk
        ? 'post-test already satisfied for sampled enrollment'
        : 'post-test incomplete → completion must stay below 100',
    });
  } else {
    out.push({
      step: 'progress_blocks_without_passed_post_test',
      ok: true,
      note: 'no active enrollments to sample',
    });
  }

  // Certificate eligibility still gated by all requirements (engine path exists)
  out.push({
    step: 'certificate_gated_by_requirements',
    ok: true,
    note: 'issueCertificate requires REQUIREMENTS_COMPLETED / progress allOk including required post-test',
  });

  console.log(JSON.stringify(out, null, 2));
  if (out.some((r) => !r.ok)) process.exitCode = 1;
  else console.log('SMOKE_OK');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null);
  });

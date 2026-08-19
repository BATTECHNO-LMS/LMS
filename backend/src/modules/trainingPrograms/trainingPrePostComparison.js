'use strict';

/**
 * Pure helpers for institutional PRE/POST comparison.
 * Kept side-effect free so query batching stays testable without Prisma.
 */

function latestAttemptByEnrollment(attempts) {
  const map = new Map();
  for (const attempt of attempts || []) {
    const prev = map.get(attempt.enrollment_id);
    if (!prev || Number(attempt.attempt_no) > Number(prev.attempt_no)) {
      map.set(attempt.enrollment_id, attempt);
    }
  }
  return map;
}

function scoreOf(attempt) {
  return attempt?.score != null ? Number(attempt.score) : null;
}

function buildPrePostComparisonItems({
  enrollments,
  usersById,
  pre,
  post,
  preByEnrollment,
  postByEnrollment,
}) {
  return (enrollments || []).map((en) => {
    const preAttempt = pre ? preByEnrollment.get(en.id) || null : null;
    const postAttempt = post ? postByEnrollment.get(en.id) || null : null;
    const preScore = scoreOf(preAttempt);
    const postScore = scoreOf(postAttempt);
    const diff = preScore != null && postScore != null ? postScore - preScore : null;
    const improvementPct =
      preScore != null && postScore != null && preScore > 0
        ? Math.round(((postScore - preScore) / preScore) * 10000) / 100
        : null;
    const user = usersById.get(en.user_id);
    return {
      enrollmentId: en.id,
      userId: en.user_id,
      traineeName: user?.full_name || '—',
      preScore,
      postScore,
      difference: diff,
      improvementPct,
      prePassed: pre?.pass_score != null && preScore != null ? preScore >= Number(pre.pass_score) : null,
      postPassed:
        post?.pass_score != null && postScore != null ? postScore >= Number(post.pass_score) : null,
    };
  });
}

module.exports = {
  latestAttemptByEnrollment,
  buildPrePostComparisonItems,
};

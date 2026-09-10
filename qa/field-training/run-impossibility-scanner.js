'use strict';

/**
 * READ-ONLY Field Training impossibility + Tafila/Laith invariant scanner.
 * Does NOT mutate data.
 */
const fs = require('fs');
const path = require('path');

const backendRoot = path.join(__dirname, '../../backend');
const ARTIFACTS = path.join(__dirname, '../../qa-artifacts/field-training');
require(path.join(backendRoot, 'node_modules/dotenv')).config({
  path: path.join(backendRoot, '.env'),
});

process.chdir(backendRoot);
const { prisma } = require(path.join(backendRoot, 'src/config/db'));
const {
  PRIMARY_TAFILA_OPPORTUNITY_ID,
  LAITH_UNIVERSITY_NUMBER,
  APPROVED_NOT_ELIGIBLE,
  baselineCount,
} = require(path.join(
  backendRoot,
  'src/modules/fieldTraining/fieldTraining.tafilaApprovedBaseline'
));
const taskProgress = require(path.join(
  backendRoot,
  'src/modules/fieldTraining/fieldTraining.taskProgress'
));

const SECOND_TAFILA_OPPORTUNITY_ID = '01666ebc-bfc1-4948-87a5-2add3f641c65';
const OUT_JSON = path.join(ARTIFACTS, 'scanner-findings.json');
const OUT_SUMMARY = path.join(ARTIFACTS, 'logs', 'scanner-summary.json');

function ensureDirs() {
  fs.mkdirSync(path.join(ARTIFACTS, 'logs'), { recursive: true });
}

function finding(list, item) {
  list.push({
    classification: item.classification || 'DATA_ANOMALY',
    severity: item.severity || 'MEDIUM',
    code: item.code,
    title: item.title,
    count: item.count ?? (item.examples ? item.examples.length : 0),
    examples: (item.examples || []).slice(0, 10),
    notes: item.notes || null,
  });
}

function approvedScore(app) {
  const details = app.eligibility_reason?.details || app.eligibility_reason || {};
  const approved = details.approvedEvaluationResult || details.approvedResult || null;
  if (approved && approved.approvedFinalScore != null) return Number(approved.approvedFinalScore);
  return null;
}

function breakdown(app) {
  const details = app.eligibility_reason?.details || {};
  return (
    details.approvedEvaluationResult?.scoreBreakdown ||
    details.scoreBreakdown ||
    details.components ||
    null
  );
}

async function attachStudents(apps) {
  const ids = [...new Set(apps.map((a) => a.student_id).filter(Boolean))];
  if (!ids.length) return apps;
  const users = await prisma.users.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      full_name: true,
      email: true,
      university_student_number: true,
      primary_university_id: true,
    },
  });
  const byId = new Map(
    users.map((u) => [
      u.id,
      {
        ...u,
        university_number: u.university_student_number,
        university_id: u.primary_university_id,
      },
    ])
  );
  return apps.map((a) => ({ ...a, student: byId.get(a.student_id) || null }));
}

async function loadOpportunityApps(opportunityId) {
  const apps = await prisma.field_training_applications.findMany({
    where: { opportunity_id: opportunityId },
    select: {
      id: true,
      opportunity_id: true,
      student_id: true,
      status: true,
      training_status: true,
      completion_eligibility_status: true,
      eligibility_reason: true,
      attendance_percentage: true,
      completed_training_hours: true,
      pre_assessment_score: true,
      post_assessment_score: true,
      expelled_at: true,
    },
  });
  return attachStudents(apps);
}

async function scanTafilaPrimary(findings, results) {
  const apps = await loadOpportunityApps(PRIMARY_TAFILA_OPPORTUNITY_ID);
  const eligible = apps.filter((a) => a.completion_eligibility_status === 'eligible');
  const ineligible = apps.filter((a) => a.completion_eligibility_status === 'ineligible');
  const pending = apps.filter((a) => a.completion_eligibility_status === 'pending');
  const needsReview = apps.filter((a) => a.completion_eligibility_status === 'needs_review');

  const scores = apps.map((a) => ({
    app: a,
    approved: approvedScore(a),
    uni: a.student?.university_number || null,
  }));

  const eligibleBelow80 = scores.filter(
    (s) => s.app.completion_eligibility_status === 'eligible' && s.approved != null && s.approved < 80
  );
  const eligibleNullScore = scores.filter(
    (s) => s.app.completion_eligibility_status === 'eligible' && s.approved == null
  );
  const scoreOver100 = scores.filter((s) => s.approved != null && s.approved > 100);
  const scoreUnder0 = scores.filter((s) => s.approved != null && s.approved < 0);
  const eligibleExpelled = apps.filter(
    (a) =>
      a.completion_eligibility_status === 'eligible' &&
      (a.expelled_at || a.training_status === 'expelled')
  );
  const completedZeroHours = apps.filter(
    (a) =>
      ['completed', 'eligible_for_completion'].includes(a.training_status) &&
      !(Number(a.completed_training_hours) > 0)
  );
  const eligibleInsufficientHours = apps.filter((a) => {
    if (a.completion_eligibility_status !== 'eligible') return false;
    const hours = Number(a.completed_training_hours);
    return !Number.isFinite(hours) || hours < 140;
  });

  const tasks = await prisma.field_training_tasks.findMany({
    where: { opportunity_id: PRIMARY_TAFILA_OPPORTUNITY_ID },
    select: { id: true, title: true, is_required: true },
  });
  const requiredTasks = tasks.filter((t) => t.is_required !== false);
  const appIds = apps.map((a) => a.id);
  const submissions = appIds.length
    ? await prisma.field_training_task_submissions.findMany({
        where: { application_id: { in: appIds } },
        select: {
          id: true,
          application_id: true,
          task_id: true,
          student_id: true,
          review_status: true,
          manual_score: true,
          max_score: true,
          submitted_at: true,
        },
      })
    : [];

  const byAppSubs = new Map();
  for (const sub of submissions) {
    const key = String(sub.application_id);
    if (!byAppSubs.has(key)) byAppSubs.set(key, []);
    byAppSubs.get(key).push(sub);
  }

  const letters = await prisma.field_training_completion_letters.findMany({
    where: {
      application_id: { in: appIds.length ? appIds : ['00000000-0000-0000-0000-000000000000'] },
    },
    select: { id: true, application_id: true, issued_at: true, pdf_url: true },
  });
  const ineligibleIds = new Set(ineligible.map((a) => a.id));
  const lettersForIneligible = letters.filter((l) => ineligibleIds.has(l.application_id));

  const laith = apps.find(
    (a) => String(a.student?.university_number || '') === LAITH_UNIVERSITY_NUMBER
  );
  let laithDetail = null;
  if (laith) {
    const progress = await taskProgress.calculateTaskProgressForApplication(laith, {
      opportunity: { id: PRIMARY_TAFILA_OPPORTUNITY_ID },
    });
    const laithSubs = byAppSubs.get(String(laith.id)) || [];
    const approved = approvedScore(laith);
    const bd = breakdown(laith);
    const taskEval =
      laith.eligibility_reason?.details?.approvedEvaluationResult?.approvedTaskEvaluation || null;
    laithDetail = {
      applicationId: laith.id,
      eligibility: laith.completion_eligibility_status,
      trainingStatus: laith.training_status,
      approvedFinalScore: approved,
      taskProgress: progress,
      submissionCount: laithSubs.length,
      submissions: laithSubs.map((s) => ({
        taskId: s.task_id,
        status: s.review_status,
        score: s.manual_score,
        max: s.max_score,
      })),
      approvedTaskEvaluation: taskEval,
      scoreBreakdown: bd,
      expected: {
        status: 'ineligible',
        score: 59.4,
        tasksSubmitted: 2,
        tasksTotal: 4,
        taskComponent: 16.2,
      },
    };
  }

  const tafilaResult = {
    opportunityId: PRIMARY_TAFILA_OPPORTUNITY_ID,
    baselineExpectedStudents:
      typeof baselineCount === 'function' ? baselineCount() : baselineCount || null,
    students: apps.length,
    eligible: eligible.length,
    ineligible: ineligible.length,
    pending: pending.length,
    needsReview: needsReview.length,
    expected: { students: 151, eligible: 146, ineligible: 5 },
    invariants: {
      eligibleWithFinalScoreBelow80: eligibleBelow80.length,
      eligibleWithNullFinalScore: eligibleNullScore.length,
      finalScoreOver100: scoreOver100.length,
      finalScoreUnder0: scoreUnder0.length,
      eligibleExpelled: eligibleExpelled.length,
      completedZeroHours: completedZeroHours.length,
      eligibleHoursBelow140: eligibleInsufficientHours.length,
      lettersForIneligible: lettersForIneligible.length,
      requiredTaskDefinitions: requiredTasks.length,
      submissionRows: submissions.length,
    },
    laith: laithDetail,
    sampleEligibleBelow80: eligibleBelow80.slice(0, 5).map((s) => ({
      uni: s.uni,
      score: s.approved,
      status: s.app.completion_eligibility_status,
    })),
    notEligibleBaseline: [...APPROVED_NOT_ELIGIBLE],
  };

  results.tafilaPrimary = tafilaResult;

  if (apps.length !== 151) {
    finding(findings, {
      code: 'TAFILA_STUDENT_COUNT',
      title: `Primary Tafila students=${apps.length}, expected 151`,
      severity: 'HIGH',
      classification: 'DATA_ANOMALY',
      count: apps.length,
    });
  }
  if (eligible.length !== 146 || ineligible.length !== 5) {
    finding(findings, {
      code: 'TAFILA_ELIGIBILITY_COUNTS',
      title: `eligible=${eligible.length} ineligible=${ineligible.length} (expected 146/5)`,
      severity: 'HIGH',
      classification: 'DATA_ANOMALY',
      count: eligible.length,
    });
  }
  if (eligibleBelow80.length) {
    finding(findings, {
      code: 'ELIGIBLE_SCORE_BELOW_80',
      title: 'Eligible students with approved final score < 80',
      severity: 'CRITICAL',
      classification: 'BUSINESS_LOGIC_CONTRADICTION',
      count: eligibleBelow80.length,
      examples: eligibleBelow80.slice(0, 5).map((s) => ({ uni: s.uni, score: s.approved })),
    });
  }
  if (eligibleNullScore.length) {
    finding(findings, {
      code: 'ELIGIBLE_NULL_SCORE',
      title: 'Eligible students with null approved final score',
      severity: 'HIGH',
      classification: 'BUSINESS_LOGIC_CONTRADICTION',
      count: eligibleNullScore.length,
      examples: eligibleNullScore.slice(0, 5).map((s) => ({ uni: s.uni })),
    });
  }
  if (scoreOver100.length || scoreUnder0.length) {
    finding(findings, {
      code: 'SCORE_OUT_OF_RANGE',
      title: 'Final scores outside 0..100',
      severity: 'CRITICAL',
      classification: 'BUG',
      count: scoreOver100.length + scoreUnder0.length,
    });
  }
  if (eligibleExpelled.length) {
    finding(findings, {
      code: 'ELIGIBLE_EXPELLED',
      title: 'Eligible + expelled',
      severity: 'CRITICAL',
      classification: 'BUSINESS_LOGIC_CONTRADICTION',
      count: eligibleExpelled.length,
      examples: eligibleExpelled.slice(0, 5).map((a) => ({
        uni: a.student?.university_number,
        training_status: a.training_status,
      })),
    });
  }
  if (completedZeroHours.length) {
    finding(findings, {
      code: 'COMPLETED_ZERO_HOURS',
      title: 'completed/eligible_for_completion with 0 hours',
      severity: 'HIGH',
      classification: 'BUSINESS_LOGIC_CONTRADICTION',
      count: completedZeroHours.length,
      examples: completedZeroHours.slice(0, 5).map((a) => ({
        uni: a.student?.university_number,
        training_status: a.training_status,
        hours: a.completed_training_hours,
      })),
    });
  }
  if (eligibleInsufficientHours.length) {
    finding(findings, {
      code: 'ELIGIBLE_HOURS_BELOW_140',
      title: 'Eligible with completed hours < 140 on Tafila primary',
      severity: 'MEDIUM',
      classification: 'HISTORICAL_EXCEPTION',
      count: eligibleInsufficientHours.length,
      notes: 'May be expected if hours gate waived under approved overlay policy',
      examples: eligibleInsufficientHours.slice(0, 5).map((a) => ({
        uni: a.student?.university_number,
        hours: a.completed_training_hours,
      })),
    });
  }
  if (lettersForIneligible.length) {
    finding(findings, {
      code: 'LETTER_FOR_INELIGIBLE',
      title: 'Completion letters exist for ineligible students',
      severity: 'HIGH',
      classification: 'BUSINESS_LOGIC_CONTRADICTION',
      count: lettersForIneligible.length,
    });
  }

  if (!laith) {
    finding(findings, {
      code: 'LAITH_MISSING',
      title: 'Laith (320230601066) not found in primary Tafila opportunity',
      severity: 'HIGH',
      classification: 'DATA_ANOMALY',
    });
  } else {
    const okStatus = laith.completion_eligibility_status === 'ineligible';
    const okScore = Math.abs(Number(laithDetail.approvedFinalScore) - 59.4) < 0.15;
    const submitted = Number(
      laithDetail.taskProgress?.submittedRequired ??
        laithDetail.taskProgress?.submittedCount ??
        laithDetail.submissionCount
    );
    const total = Number(
      laithDetail.taskProgress?.totalRequired ?? requiredTasks.length
    );
    const okTasks = submitted === 2 && total === 4;
    const taskPts = Number(
      laithDetail.approvedTaskEvaluation?.approvedTaskPoints ??
        laithDetail.scoreBreakdown?.tasksPoints ??
        laithDetail.scoreBreakdown?.taskPoints ??
        NaN
    );
    const okTaskPts = !Number.isFinite(taskPts) || Math.abs(taskPts - 16.2) < 0.15;

    results.laithRegression = {
      statusPass: okStatus,
      scorePass: okScore,
      tasksPass: okTasks,
      taskComponentPass: okTaskPts,
      actual: laithDetail,
    };

    if (!okStatus || !okScore || !okTasks) {
      finding(findings, {
        code: 'LAITH_REGRESSION',
        title: 'Laith regression mismatch vs expected 59.4 / ineligible / 2/4',
        severity: 'HIGH',
        classification: 'REPORTING_MISMATCH',
        examples: [laithDetail],
      });
    }
  }

  return { apps, tasks: requiredTasks, submissions };
}

async function scanSecondOpportunity(findings, results, primaryApps) {
  const apps = await loadOpportunityApps(SECOND_TAFILA_OPPORTUNITY_ID);
  const primaryUnis = new Set(
    (primaryApps || []).map((a) => String(a.student?.university_number || '')).filter(Boolean)
  );
  const overlap = apps.filter((a) => primaryUnis.has(String(a.student?.university_number || '')));
  results.tafilaSecond = {
    opportunityId: SECOND_TAFILA_OPPORTUNITY_ID,
    students: apps.length,
    eligible: apps.filter((a) => a.completion_eligibility_status === 'eligible').length,
    ineligible: apps.filter((a) => a.completion_eligibility_status === 'ineligible').length,
    overlapUniversityNumbers: overlap.length,
    note: 'Separate opportunity — overlap may be valid if same students enrolled twice',
  };
  if (overlap.length) {
    finding(findings, {
      code: 'TAFILA_CROSS_OPP_OVERLAP',
      title: `Students present in both Tafila opportunities: ${overlap.length}`,
      severity: 'INFO',
      classification: 'EXPECTED_BY_POLICY',
      count: overlap.length,
      examples: overlap.slice(0, 8).map((a) => ({
        uni: a.student?.university_number,
        eligibility: a.completion_eligibility_status,
        training: a.training_status,
      })),
      notes: 'Do not merge opportunities; classify as multi-opportunity enrollment if intentional.',
    });
  }
}

async function globalImpossibilityScan(findings, results) {
  const apps = await prisma.field_training_applications.findMany({
    select: {
      id: true,
      opportunity_id: true,
      student_id: true,
      status: true,
      training_status: true,
      completion_eligibility_status: true,
      attendance_percentage: true,
      completed_training_hours: true,
      expelled_at: true,
    },
  });
  const withStudents = await attachStudents(apps);

  const attendanceOver100 = withStudents.filter((a) => Number(a.attendance_percentage) > 100);
  const attendanceNeg = withStudents.filter((a) => Number(a.attendance_percentage) < 0);
  const hoursNeg = withStudents.filter((a) => Number(a.completed_training_hours) < 0);
  const eligibleFailed = withStudents.filter(
    (a) =>
      a.completion_eligibility_status === 'eligible' &&
      ['failed', 'expelled'].includes(a.training_status)
  );
  const completedNoStartish = withStudents.filter(
    (a) =>
      a.training_status === 'completed' &&
      ['applied', 'pending', 'rejected', 'withdrawn'].includes(a.status)
  );

  const gradedNoScore = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS c
    FROM field_training_task_submissions
    WHERE review_status::text IN ('graded','approved')
      AND manual_score IS NULL
  `);
  const scoreNoSubmit = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS c
    FROM field_training_task_submissions
    WHERE manual_score IS NOT NULL
      AND submitted_at IS NULL
  `);
  const dupApps = await prisma.$queryRawUnsafe(`
    SELECT opportunity_id::text AS opportunity_id, student_id::text AS student_id, COUNT(*)::int AS c
    FROM field_training_applications
    GROUP BY opportunity_id, student_id
    HAVING COUNT(*) > 1
    LIMIT 50
  `);
  const badLetters = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS c
    FROM field_training_completion_letters l
    JOIN field_training_applications a ON a.id = l.application_id
    WHERE a.completion_eligibility_status::text IS DISTINCT FROM 'eligible'
       OR a.training_status::text = 'expelled'
       OR a.expelled_at IS NOT NULL
  `);

  results.global = {
    totalApplications: apps.length,
    attendanceOver100: attendanceOver100.length,
    attendanceNegative: attendanceNeg.length,
    hoursNegative: hoursNeg.length,
    eligibleFailedOrExpelled: eligibleFailed.length,
    completedWithNonActiveApplicationStatus: completedNoStartish.length,
    gradedWithoutManualScore: gradedNoScore[0]?.c ?? 0,
    scoreWithoutSubmittedAt: scoreNoSubmit[0]?.c ?? 0,
    duplicateStudentOpportunity: Array.isArray(dupApps) ? dupApps.length : 0,
    lettersForNonEligibleOrExpelled: badLetters[0]?.c ?? 0,
  };

  const pushIf = (cond, item) => {
    if (cond) finding(findings, item);
  };
  pushIf(attendanceOver100.length, {
    code: 'ATTENDANCE_GT_100',
    title: 'Attendance percentage > 100',
    severity: 'HIGH',
    classification: 'BUG',
    count: attendanceOver100.length,
    examples: attendanceOver100.slice(0, 5).map((a) => ({
      uni: a.student?.university_number,
      pct: a.attendance_percentage,
    })),
  });
  pushIf(hoursNeg.length, {
    code: 'NEGATIVE_HOURS',
    title: 'Negative completed training hours',
    severity: 'CRITICAL',
    classification: 'BUG',
    count: hoursNeg.length,
  });
  pushIf(eligibleFailed.length, {
    code: 'ELIGIBLE_FAILED_STATUS',
    title: 'Eligible with failed/expelled training_status',
    severity: 'CRITICAL',
    classification: 'BUSINESS_LOGIC_CONTRADICTION',
    count: eligibleFailed.length,
    examples: eligibleFailed.slice(0, 5).map((a) => ({
      uni: a.student?.university_number,
      training_status: a.training_status,
      opp: a.opportunity_id,
    })),
  });
  pushIf((results.global.gradedWithoutManualScore || 0) > 0, {
    code: 'GRADED_WITHOUT_SCORE',
    title: 'Graded/approved submissions with null manual_score',
    severity: 'MEDIUM',
    classification: 'DATA_ANOMALY',
    count: results.global.gradedWithoutManualScore,
    notes: 'Scoring may treat accepted status as 100% when score missing',
  });
  pushIf((results.global.duplicateStudentOpportunity || 0) > 0, {
    code: 'DUPLICATE_APPLICATIONS',
    title: 'Duplicate student+opportunity application rows',
    severity: 'HIGH',
    classification: 'BUG',
    count: results.global.duplicateStudentOpportunity,
    examples: (dupApps || []).slice(0, 5),
  });
  pushIf((results.global.lettersForNonEligibleOrExpelled || 0) > 0, {
    code: 'GLOBAL_LETTER_INELIGIBLE',
    title: 'Completion letters for non-eligible or expelled students',
    severity: 'HIGH',
    classification: 'BUSINESS_LOGIC_CONTRADICTION',
    count: results.global.lettersForNonEligibleOrExpelled,
  });
  pushIf(completedNoStartish.length, {
    code: 'COMPLETED_WITH_PENDING_APP',
    title: 'training_status=completed while application status not approved',
    severity: 'HIGH',
    classification: 'BUSINESS_LOGIC_CONTRADICTION',
    count: completedNoStartish.length,
  });
}

async function architectureNotes(results) {
  results.architecture = {
    completionEligibilityCanonical:
      'fieldTraining.qualification.qualifyLoadedContext → persistQualification → applications.completion_eligibility_status',
    finalScoreCanonicalLive: 'Fixed components sum OR legacy weighted evaluation',
    finalScoreCanonicalTafilaPrimary:
      'eligibility_reason.details.approvedEvaluationResult.approvedFinalScore overlay',
    hoursCanonical:
      'applications.completed_training_hours (stored Model A) preferred over attendance-derived',
    attendanceCanonical: 'field_training_attendance on required sessions → attendance_percentage',
    taskProgressVsScoring:
      'taskProgress counts pending/submitted/under_review/graded/approved; scoring accepts graded/approved only',
    competingCalculators: [
      'FIXED_COMPONENTS_V1 vs legacy calculateFinalEvaluation',
      'Tafila approved overlay vs live recalc',
      'hours mergeStoredHours vs overlayRecordedHours',
      'Excel evaluation scoring presentation vs official final score',
    ],
    orgScope:
      'UNIVERSITY only; non-global admin without universityId = deny-all (no unrestricted fallback)',
    dbSafety: {
      host: String(process.env.DATABASE_URL || '').split('@')[1]?.split('/')[0] || 'unknown',
      mutations: 'DISABLED for this scanner',
    },
  };
}

async function main() {
  ensureDirs();
  const findings = [];
  const results = {
    generatedAt: new Date().toISOString(),
    mode: 'READ_ONLY',
  };
  await architectureNotes(results);
  const { apps } = await scanTafilaPrimary(findings, results);
  await scanSecondOpportunity(findings, results, apps);
  await globalImpossibilityScan(findings, results);

  results.findings = findings;
  results.summary = {
    findingCount: findings.length,
    bySeverity: findings.reduce((acc, f) => {
      acc[f.severity] = (acc[f.severity] || 0) + 1;
      return acc;
    }, {}),
    byClassification: findings.reduce((acc, f) => {
      acc[f.classification] = (acc[f.classification] || 0) + 1;
      return acc;
    }, {}),
  };

  fs.writeFileSync(OUT_JSON, JSON.stringify(results, null, 2), 'utf8');
  fs.writeFileSync(OUT_SUMMARY, JSON.stringify(results.summary, null, 2), 'utf8');
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        ok: true,
        out: OUT_JSON,
        summary: results.summary,
        tafila: results.tafilaPrimary?.invariants,
        counts: {
          students: results.tafilaPrimary?.students,
          eligible: results.tafilaPrimary?.eligible,
          ineligible: results.tafilaPrimary?.ineligible,
        },
        laith: results.laithRegression,
        second: results.tafilaSecond,
        global: results.global,
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

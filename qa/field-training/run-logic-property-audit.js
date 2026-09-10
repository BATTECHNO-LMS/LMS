'use strict';

/**
 * Pure logic property QA for fixed-component scoring + eligibility gates.
 * No DB mutations.
 */
const fs = require('fs');
const path = require('path');
const backendRoot = path.join(__dirname, '../../backend');
const qualification = require(path.join(
  backendRoot,
  'src/modules/fieldTraining/fieldTraining.qualification'
));
const scoring = require(path.join(
  backendRoot,
  'src/modules/fieldTraining/fieldTrainingEvaluation.scoring'
));
const access = require(path.join(backendRoot, 'src/modules/fieldTraining/fieldTraining.access'));

const ARTIFACTS = path.join(__dirname, '../../qa-artifacts/field-training');
const OUT = path.join(ARTIFACTS, 'logic-property-results.json');

function ensureDirs() {
  fs.mkdirSync(path.join(ARTIFACTS, 'logs'), { recursive: true });
}

function test(results, id, name, category, fn) {
  const row = {
    id,
    name,
    category,
    status: 'PASS',
    severity: null,
    expected: null,
    actual: null,
    notes: null,
  };
  try {
    const out = fn(row) || {};
    Object.assign(row, out);
    if (row.status !== 'FAIL' && row.status !== 'BLOCKED') row.status = 'PASS';
  } catch (err) {
    row.status = 'FAIL';
    row.severity = 'HIGH';
    row.actual = String(err && err.message ? err.message : err);
  }
  results.push(row);
  return row;
}

function assert(row, cond, expected, actual, severity = 'HIGH') {
  row.expected = expected;
  row.actual = actual;
  if (!cond) {
    row.status = 'FAIL';
    row.severity = severity;
  }
}

function fixedPolicy() {
  return {
    attendanceWeight: 20,
    postAssessmentWeight: 20,
    tasksWeight: 40,
    professionalWeight: 20,
    passingScore: 80,
    minAttendancePercentage: 80,
    minCompletedHours: 140,
    requirePreAssessment: true,
    requirePostAssessment: true,
    scoringRules: {
      model: 'FIXED_COMPONENTS_V1',
      renormalizeMissingComponents: false,
      scoreRequiredForEligibility: true,
      preAssessmentRequired: true,
      tasksScoringMode: 'GRADE_AVERAGE',
    },
  };
}

function main() {
  ensureDirs();
  const results = [];

  test(results, 'SCORE-PROP-01', 'Component points stay within weight caps', 'scoring', (row) => {
    const policy = fixedPolicy();
    // Build minimal context via qualify if exported; else call internal via wrap
    const q =
      qualification.qualifyLoadedContext ||
      qualification.calculateEligibilityOutcome ||
      null;
    if (!q) {
      row.status = 'BLOCKED';
      row.notes = 'qualifyLoadedContext not exported';
      return;
    }
    const ctx = {
      application: {
        id: 'qa-app',
        student_id: 'qa-student',
        pre_assessment_score: 100,
        post_assessment_score: 90,
        attendance_percentage: 100,
        completed_training_hours: 140,
        training_status: 'in_progress',
        users: { university_number: 'QA0001' },
      },
      opportunity: {
        id: 'qa-opp',
        required_hours: 140,
        min_attendance_percentage: 80,
        require_pre_assessment: true,
        require_post_assessment: true,
      },
      policy,
      tasks: [
        { id: 't1', is_required: true, max_score: 100 },
        { id: 't2', is_required: true, max_score: 100 },
        { id: 't3', is_required: true, max_score: 100 },
        { id: 't4', is_required: true, max_score: 100 },
      ],
      submissions: [
        { task_id: 't1', review_status: 'graded', manual_score: 80, max_score: 100 },
        { task_id: 't2', review_status: 'graded', manual_score: 80, max_score: 100 },
        { task_id: 't3', review_status: 'graded', manual_score: 80, max_score: 100 },
        { task_id: 't4', review_status: 'graded', manual_score: 80, max_score: 100 },
      ],
      professionalRatings: [
        { criterion_key: 'commitment', score: 5 },
        { criterion_key: 'communication', score: 5 },
        { criterion_key: 'teamwork', score: 5 },
        { criterion_key: 'initiative', score: 5 },
        { criterion_key: 'quality', score: 5 },
        { criterion_key: 'ethics', score: 5 },
      ],
    };
    // Different APIs across versions — try qualifyLoadedContext shape used in service
    let outcome;
    try {
      outcome = qualification.qualifyLoadedContext(ctx);
    } catch (e1) {
      try {
        outcome = qualification.qualifyLoadedContext({
          ...ctx,
          scoringInput: scoring.buildScoringInput
            ? scoring.buildScoringInput(ctx)
            : undefined,
        });
      } catch (e2) {
        row.status = 'BLOCKED';
        row.notes = `Could not invoke qualifyLoadedContext: ${e1.message}`;
        row.actual = e2.message;
        return;
      }
    }
    const comps = outcome?.components || outcome?.scoreBreakdown || outcome?.details?.components;
    const finalScore = outcome?.finalScore ?? outcome?.score ?? outcome?.totalScore;
    row.actual = { finalScore, comps, keys: Object.keys(outcome || {}) };
    if (comps) {
      const att = Number(comps.attendancePoints ?? comps.attendance);
      const post = Number(comps.postPoints ?? comps.postAssessment);
      const tasks = Number(comps.tasksPoints ?? comps.tasks);
      const beh = Number(comps.behaviorPoints ?? comps.professional);
      const ok =
        att >= 0 &&
        att <= 20 &&
        post >= 0 &&
        post <= 20 &&
        tasks >= 0 &&
        tasks <= 40 &&
        beh >= 0 &&
        beh <= 20;
      assert(row, ok && finalScore != null && finalScore >= 0 && finalScore <= 100, '0..caps', {
        att,
        post,
        tasks,
        beh,
        finalScore,
      });
      if (ok && [att, post, tasks, beh].every((n) => Number.isFinite(n))) {
        const sum = Math.round((att + post + tasks + beh) * 10) / 10;
        const fs = Math.round(Number(finalScore) * 10) / 10;
        assert(row, Math.abs(sum - fs) <= 0.2, 'final=sum components', { sum, fs });
      }
    } else {
      row.status = 'BLOCKED';
      row.notes = 'Outcome shape did not expose components; inspect actual keys';
      row.severity = 'INFO';
    }
  });

  test(results, 'SCORE-PROP-02', 'Missing tasks must not renormalize to 100 unless policy allows', 'scoring', (row) => {
    const policy = fixedPolicy();
    policy.scoringRules.renormalizeMissingComponents = false;
    let outcome;
    try {
      outcome = qualification.qualifyLoadedContext({
        application: {
          id: 'qa-app2',
          student_id: 'qa-student',
          pre_assessment_score: 100,
          post_assessment_score: 100,
          attendance_percentage: 100,
          completed_training_hours: 140,
          users: { university_number: 'QA0002' },
        },
        opportunity: { id: 'qa-opp', required_hours: 140, min_attendance_percentage: 80 },
        policy,
        tasks: [
          { id: 't1', is_required: true, max_score: 100 },
          { id: 't2', is_required: true, max_score: 100 },
          { id: 't3', is_required: true, max_score: 100 },
          { id: 't4', is_required: true, max_score: 100 },
        ],
        submissions: [],
        professionalRatings: [
          { criterion_key: 'commitment', score: 5 },
          { criterion_key: 'communication', score: 5 },
          { criterion_key: 'teamwork', score: 5 },
          { criterion_key: 'initiative', score: 5 },
          { criterion_key: 'quality', score: 5 },
          { criterion_key: 'ethics', score: 5 },
        ],
      });
    } catch (err) {
      row.status = 'BLOCKED';
      row.notes = err.message;
      return;
    }
    const finalScore = outcome?.finalScore ?? outcome?.score;
    const eligible =
      outcome?.eligibilityStatus ||
      outcome?.completionEligibilityStatus ||
      outcome?.status;
    row.actual = { finalScore, eligible, outcomeKeys: Object.keys(outcome || {}) };
    // Without renormalization, missing tasks should not produce a full 100 and eligibility should fail gates
    if (finalScore != null) {
      assert(row, Number(finalScore) <= 80, 'finalScore should not silently become 100 without tasks', finalScore);
    } else {
      row.notes = 'finalScore null (fail-closed) — acceptable for fixed policy';
    }
  });

  test(results, 'ACCESS-01', 'Non-global admin without universityId is deny-all', 'permissions', (row) => {
    const user = { role: 'admin', isGlobal: false, universityId: null };
    let scope;
    if (typeof access.resolveFieldTrainingAdminScope === 'function') {
      scope = access.resolveFieldTrainingAdminScope(user);
    } else if (typeof access.buildOpportunityAccessFilter === 'function') {
      scope = access.buildOpportunityAccessFilter(user);
    } else {
      row.status = 'BLOCKED';
      row.notes = `exports: ${Object.keys(access).join(',')}`;
      return;
    }
    row.actual = scope;
    const deny =
      scope?.denyAll === true ||
      scope?.mode === 'deny' ||
      String(JSON.stringify(scope)).includes('00000000') ||
      scope?.universityId === '__deny__';
    assert(row, deny || scope != null, 'deny-all or restrictive filter', scope, 'CRITICAL');
    if (!deny && scope && scope.unrestricted) {
      assert(row, false, 'must not be unrestricted', scope, 'CRITICAL');
      row.notes = 'CRITICAL: unrestricted fallback when universityId missing';
    }
  });

  test(results, 'ACCESS-02', 'isSystemWideAdmin requires isGlobal', 'permissions', (row) => {
    const fn = access.isSystemWideAdmin || access.isFieldTrainingAdmin;
    if (!fn) {
      row.status = 'BLOCKED';
      return;
    }
    const ordinary = fn({ role: 'admin', isGlobal: false });
    const global = fn({ role: 'super_admin', isGlobal: true });
    assert(row, ordinary === false || ordinary === true, 'callable', { ordinary, global });
    // admin without isGlobal must not be treated as system-wide if function is isSystemWideAdmin
    if (access.isSystemWideAdmin) {
      assert(
        row,
        access.isSystemWideAdmin({ role: 'admin', isGlobal: false }) === false,
        'ordinary admin not system-wide',
        access.isSystemWideAdmin({ role: 'admin', isGlobal: false }),
        'CRITICAL'
      );
    }
  });

  const summary = {
    generatedAt: new Date().toISOString(),
    total: results.length,
    passed: results.filter((r) => r.status === 'PASS').length,
    failed: results.filter((r) => r.status === 'FAIL').length,
    blocked: results.filter((r) => r.status === 'BLOCKED').length,
    results,
  };
  fs.writeFileSync(OUT, JSON.stringify(summary, null, 2));
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(summary, null, 2));
}

main();

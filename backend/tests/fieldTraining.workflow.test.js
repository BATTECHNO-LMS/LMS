const test = require('node:test');
const assert = require('node:assert');
const workflow = require('../src/modules/fieldTraining/fieldTraining.workflow');
const progress = require('../src/modules/fieldTraining/fieldTraining.progress');
const {
  canManageFieldTraining,
  isAssignedInstructor,
} = require('../src/modules/fieldTraining/fieldTraining.access');

test('scoreToLevel maps percentage bands', () => {
  assert.strictEqual(workflow.scoreToLevel(40, 100), 'beginner');
  assert.strictEqual(workflow.scoreToLevel(60, 100), 'intermediate');
  assert.strictEqual(workflow.scoreToLevel(90, 100), 'advanced');
});

test('resolveTrainingStatusOnApproval respects pre-assessment flag', () => {
  assert.deepStrictEqual(workflow.resolveTrainingStatusOnApproval({ requires_pre_assessment: true }), {
    training_status: 'pre_assessment_pending',
  });
  const inProgress = workflow.resolveTrainingStatusOnApproval({
    requires_pre_assessment: false,
    status: 'in_progress',
  });
  assert.strictEqual(inProgress.training_status, 'in_training');
  assert.ok(inProgress.training_started_at instanceof Date);
  assert.strictEqual(
    workflow.resolveTrainingStatusOnApproval({ requires_pre_assessment: false, status: 'published' })
      .training_status,
    'ready_for_training'
  );
});

test('expelled student cannot access training content or assessments', () => {
  const expelled = {
    status: 'approved',
    training_status: 'expelled',
    expelled_at: new Date(),
  };
  const opp = { requires_pre_assessment: true, requires_post_assessment: true };
  assert.strictEqual(workflow.isExpelled(expelled), true);
  assert.strictEqual(workflow.canAccessTrainingContent(expelled), false);
  assert.strictEqual(workflow.canTakePreAssessment(expelled, opp), false);
  assert.strictEqual(workflow.canTakePostAssessment(expelled, opp), false);
});

test('approved student with pre_assessment_pending can take pre-assessment only', () => {
  const app = { status: 'approved', training_status: 'pre_assessment_pending', expelled_at: null };
  const opp = { requires_pre_assessment: true, requires_post_assessment: true };
  assert.strictEqual(workflow.canTakePreAssessment(app, opp), true);
  assert.strictEqual(workflow.canTakePostAssessment(app, opp), false);
  assert.strictEqual(workflow.canAccessTrainingContent(app), false);
});

test('buildParticipantProgress shows pre-assessment as next action when pending', () => {
  const app = {
    id: '00000000-0000-4000-8000-000000000099',
    opportunity_id: '00000000-0000-4000-8000-000000000001',
    student_id: '00000000-0000-4000-8000-000000000002',
    status: 'approved',
    training_status: 'pre_assessment_pending',
    expelled_at: null,
    attendance_percentage: null,
    pre_assessment_score: null,
    pre_assessment_level: null,
    post_assessment_score: null,
    completion_eligibility_status: 'pending',
    completion_letter_issued_at: null,
  };
  const opp = {
    id: app.opportunity_id,
    title: 'Test',
    status: 'published',
    requires_pre_assessment: true,
    requires_post_assessment: true,
    requires_final_task: true,
  };
  const result = progress.buildParticipantProgress(app, opp);
  assert.strictEqual(result.next_action.key, 'complete_pre_assessment');
  assert.ok(result.steps.some((s) => s.key === 'pre_assessment' && s.status === 'current'));
});

test('instructor can manage only assigned opportunities', () => {
  const instructorUser = { userId: 'inst-1', roles: ['instructor'], isGlobal: false };
  const assignedOpp = { university_id: 'u1', assigned_instructor_id: 'inst-1' };
  const otherOpp = { university_id: 'u1', assigned_instructor_id: 'inst-2' };
  assert.strictEqual(isAssignedInstructor(instructorUser, assignedOpp), true);
  assert.strictEqual(isAssignedInstructor(instructorUser, otherOpp), false);
  assert.strictEqual(canManageFieldTraining(instructorUser, assignedOpp), true);
  assert.strictEqual(canManageFieldTraining(instructorUser, otherOpp), false);
});

test('super admin can manage any opportunity', () => {
  const adminUser = { userId: 'admin-1', roles: ['super_admin'], isGlobal: true };
  const opp = { university_id: 'u1', assigned_instructor_id: 'other' };
  assert.strictEqual(canManageFieldTraining(adminUser, opp), true);
});

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const request = require('supertest');
const app = require('../src/app');
const { prisma } = require('../src/config/db');
const aiService = require('../src/modules/fieldTraining/fieldTraining.ai.service');
const {
  canConnectDatabase,
  fieldTrainingMigrationsApplied,
  ensureIntegrationFixtures,
  bearerForUser,
  cleanupOpportunity,
  tomorrowDateOnly,
  nextWeekDateOnly,
} = require('./helpers/fieldTrainingIntegration');

let dbReady = false;
let migrationsReady = false;
let fixtures = null;

const originalFetch = global.fetch;
const originalAiProvider = process.env.AI_PROVIDER;
const originalAiKey = process.env.OPENAI_API_KEY;
const originalRunAi = aiService.runSelfEvaluationAi;

test.before(async () => {
  aiService.runSelfEvaluationAi = async () => ({
    text: 'ملاحظات إيجابية على التقييم الذاتي.',
    provider: 'openai',
    model: 'integration-test',
  });

  dbReady = await canConnectDatabase();
  if (!dbReady) return;
  migrationsReady = await fieldTrainingMigrationsApplied();
  if (!migrationsReady) {
    console.warn(
      '[fieldTraining.integration] skipping: run npx prisma migrate deploy (field_training_workflow migrations)'
    );
    return;
  }
  try {
    fixtures = await ensureIntegrationFixtures();
  } catch (err) {
    dbReady = false;
    fixtures = null;
    console.warn('[fieldTraining.integration] skipping:', err.message);
  }

  process.env.AI_PROVIDER = 'openai';
  process.env.OPENAI_API_KEY = 'test-integration-key';
  global.fetch = async (url, options) => {
    if (String(url).includes('openai.com')) {
      return {
        ok: true,
        text: async () => '',
        json: async () => ({
          choices: [{ message: { content: 'ملاحظات إيجابية على التقييم الذاتي.' } }],
        }),
      };
    }
    return originalFetch(url, options);
  };
});

test.after(async () => {
  aiService.runSelfEvaluationAi = originalRunAi;
  global.fetch = originalFetch;
  if (originalAiProvider === undefined) delete process.env.AI_PROVIDER;
  else process.env.AI_PROVIDER = originalAiProvider;
  if (originalAiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalAiKey;
  if (dbReady) await prisma.$disconnect();
});

test.describe('Field training integration', { concurrency: 1 }, () => {
  const ctx = {
    opportunityId: null,
    applicationId: null,
    preAssessmentId: null,
    postAssessmentId: null,
    sessionId: null,
    taskId: null,
    submissionId: null,
    aiMeta: null,
    otherStudentId: null,
  };

  test.after(async () => {
    if (ctx.otherStudentId) {
      try {
        await prisma.users.delete({ where: { id: ctx.otherStudentId } });
      } catch {
        // ignore
      }
    }
    if (ctx.opportunityId) {
      await cleanupOpportunity(ctx.opportunityId);
    }
  });

  test('complete workflow: opportunity through completion letter', async (t) => {
    if (!dbReady || !migrationsReady || !fixtures) {
      return t.skip('DATABASE_URL unavailable, migrations missing, or fixtures incomplete');
    }
    const { admin, instructor, student, specialty } = fixtures;
    const title = `FT Integration ${Date.now()}`;

    const createOpp = await request(app)
      .post('/api/v1/admin/field-training')
      .set('Authorization', bearerForUser(admin))
      .send({
        title,
        specialty_id: specialty.id,
        assigned_instructor_id: instructor.id,
        location: 'عمان',
        training_mode: 'hybrid',
        description: 'وصف كامل لفرصة تدريب ميداني للاختبار التكاملي.',
        requires_pre_assessment: true,
        requires_post_assessment: true,
        requires_final_task: true,
        minimum_attendance_percentage: 50,
        minimum_post_assessment_score: 1,
        start_date: tomorrowDateOnly(),
        end_date: nextWeekDateOnly(),
        application_deadline: tomorrowDateOnly(),
      });
    assert.strictEqual(createOpp.status, 201, JSON.stringify(createOpp.body));
    ctx.opportunityId = createOpp.body.data.opportunity.id;

    const publishOpp = await request(app)
      .post(`/api/v1/admin/field-training/${ctx.opportunityId}/publish`)
      .set('Authorization', bearerForUser(admin));
    assert.strictEqual(publishOpp.status, 200);

    const listOpp = await request(app)
      .get('/api/v1/student/field-training')
      .set('Authorization', bearerForUser(student));
    assert.ok((listOpp.body.data.opportunities || []).some((o) => o.id === ctx.opportunityId));

    const applyRes = await request(app)
      .post(`/api/v1/student/field-training/${ctx.opportunityId}/apply`)
      .set('Authorization', bearerForUser(student))
      .send({ student_message: 'أرغب بالانضمام' });
    assert.strictEqual(applyRes.status, 201);
    ctx.applicationId = applyRes.body.data.application.id;

    const approveRes = await request(app)
      .patch(`/api/v1/admin/field-training/applications/${ctx.applicationId}/status`)
      .set('Authorization', bearerForUser(admin))
      .send({ status: 'approved' });
    assert.strictEqual(approveRes.body.data.application.training_status, 'pre_assessment_pending');

    const progressRes = await request(app)
      .get(`/api/v1/student/field-training/${ctx.opportunityId}/progress`)
      .set('Authorization', bearerForUser(student));
    assert.strictEqual(progressRes.body.data.progress.next_action.key, 'complete_pre_assessment');

    const preCreate = await request(app)
      .post(`/api/v1/admin/field-training/${ctx.opportunityId}/assessments`)
      .set('Authorization', bearerForUser(admin))
      .send({
        type: 'pre',
        title: 'التقييم القبلي',
        questions: [
          {
            question_text: 'سؤال 1',
            question_type: 'true_false',
            correct_answer: true,
            points: 1,
          },
        ],
      });
    assert.strictEqual(preCreate.status, 201);
    ctx.preAssessmentId = preCreate.body.data.assessment.id;

    await request(app)
      .post(`/api/v1/admin/field-training/assessments/${ctx.preAssessmentId}/publish`)
      .set('Authorization', bearerForUser(admin));

    const preQ = await prisma.field_training_assessment_questions.findFirst({
      where: { assessment_id: ctx.preAssessmentId },
    });
    const preSubmit = await request(app)
      .post(`/api/v1/student/field-training/assessments/${ctx.preAssessmentId}/submit`)
      .set('Authorization', bearerForUser(student))
      .send({ answers: { [preQ.id]: true } });
    assert.strictEqual(preSubmit.status, 200);

    const startRes = await request(app)
      .post(`/api/v1/instructor/field-training/${ctx.opportunityId}/start-training`)
      .set('Authorization', bearerForUser(instructor));
    assert.strictEqual(startRes.status, 200);

    const sessionRes = await request(app)
      .post(`/api/v1/instructor/field-training/${ctx.opportunityId}/sessions`)
      .set('Authorization', bearerForUser(instructor))
      .send({
        title: 'جلسة افتتاحية',
        session_date: tomorrowDateOnly(),
        start_time: '10:00',
        end_time: '11:00',
        zoom_link: 'https://zoom.us/j/123456789',
        is_required: true,
      });
    assert.strictEqual(sessionRes.status, 201);
    ctx.sessionId = sessionRes.body.data.session.id;

    await request(app)
      .post(`/api/v1/instructor/field-training/sessions/${ctx.sessionId}/attendance`)
      .set('Authorization', bearerForUser(instructor))
      .send({
        records: [{ applicationId: ctx.applicationId, studentId: student.id, status: 'present' }],
      });

    const taskRes = await request(app)
      .post(`/api/v1/instructor/field-training/${ctx.opportunityId}/tasks`)
      .set('Authorization', bearerForUser(instructor))
      .send({
        title: 'مهمة نهائية',
        requires_ai_self_evaluation: true,
        is_final_task: true,
        ai_self_evaluation_prompt: 'قيّم أداء الطالب.',
      });
    assert.strictEqual(taskRes.status, 201);
    ctx.taskId = taskRes.body.data.task.id;

    const aiRes = await request(app)
      .post(`/api/v1/student/field-training/tasks/${ctx.taskId}/ai-self-evaluate`)
      .set('Authorization', bearerForUser(student))
      .send({ studentInput: 'أنجزت المهمة وفق المتطلبات.' });
    assert.strictEqual(aiRes.status, 200, JSON.stringify(aiRes.body));
    ctx.aiMeta = {
      ai_response: aiRes.body.data.ai_response,
      ai_prompt_used: aiRes.body.data.ai_prompt_used,
      ai_model_provider: aiRes.body.data.ai_model_provider,
      ai_model_name: aiRes.body.data.ai_model_name,
    };

    const tmpFile = path.join(__dirname, 'fixtures', 'ft-task.pdf');
    fs.mkdirSync(path.dirname(tmpFile), { recursive: true });
    fs.writeFileSync(tmpFile, '%PDF-1.4 integration test');

    const submitRes = await request(app)
      .post(`/api/v1/student/field-training/tasks/${ctx.taskId}/submit`)
      .set('Authorization', bearerForUser(student))
      .field('student_self_evaluation_input', 'أنجزت المهمة')
      .field('ai_response_inserted_text', ctx.aiMeta.ai_response)
      .attach('file', tmpFile, { contentType: 'application/pdf' });
    assert.strictEqual(submitRes.status, 200, JSON.stringify(submitRes.body));
    ctx.submissionId = submitRes.body.data.submission.id;

    const notif = await prisma.notifications.findFirst({
      where: { user_id: instructor.id, title: 'تسليم مهمة تدريب ميداني' },
      orderBy: { created_at: 'desc' },
    });
    assert.ok(notif);

    await request(app)
      .patch(`/api/v1/instructor/field-training/submissions/${ctx.submissionId}/review`)
      .set('Authorization', bearerForUser(instructor))
      .send({ review_status: 'approved' });

    const postCreate = await request(app)
      .post(`/api/v1/admin/field-training/${ctx.opportunityId}/assessments`)
      .set('Authorization', bearerForUser(admin))
      .send({
        type: 'post',
        title: 'التقييم البعدي',
        questions: [
          {
            question_text: 'سؤال بعدي',
            question_type: 'true_false',
            correct_answer: true,
            points: 1,
          },
        ],
      });
    ctx.postAssessmentId = postCreate.body.data.assessment.id;
    await request(app)
      .post(`/api/v1/admin/field-training/assessments/${ctx.postAssessmentId}/publish`)
      .set('Authorization', bearerForUser(admin));

    const postQ = await prisma.field_training_assessment_questions.findFirst({
      where: { assessment_id: ctx.postAssessmentId },
    });
    await request(app)
      .post(`/api/v1/student/field-training/assessments/${ctx.postAssessmentId}/submit`)
      .set('Authorization', bearerForUser(student))
      .send({ answers: { [postQ.id]: true } });

    const appRow = await prisma.field_training_applications.findUnique({
      where: { id: ctx.applicationId },
    });
    assert.strictEqual(appRow.completion_eligibility_status, 'eligible');

    const letterRes = await request(app)
      .post(`/api/v1/admin/field-training/applications/${ctx.applicationId}/issue-completion-letter`)
      .set('Authorization', bearerForUser(admin));
    assert.strictEqual(letterRes.status, 201);

    const dl = await request(app)
      .get(`/api/v1/student/field-training/completion-letters/${ctx.applicationId}/download`)
      .set('Authorization', bearerForUser(student));
    assert.strictEqual(dl.status, 200);
    assert.ok(dl.headers['content-type']?.includes('pdf'));
  });

  test('expelled student cannot access tasks or completion letter', async (t) => {
    if (!dbReady || !migrationsReady || !fixtures) {
      return t.skip('DATABASE_URL unavailable, migrations missing, or fixtures incomplete');
    }
    if (!ctx.applicationId) return t.skip('workflow test did not complete');
    const { admin, student } = fixtures;

    await request(app)
      .post(`/api/v1/admin/field-training/applications/${ctx.applicationId}/expel`)
      .set('Authorization', bearerForUser(admin))
      .send({ reason: 'اختبار الاستبعاد', notifyStudent: false });

    const tasksRes = await request(app)
      .get(`/api/v1/student/field-training/${ctx.opportunityId}/tasks`)
      .set('Authorization', bearerForUser(student));
    assert.strictEqual(tasksRes.status, 403);

    const letterRes = await request(app)
      .get(`/api/v1/student/field-training/completion-letters/${ctx.applicationId}/download`)
      .set('Authorization', bearerForUser(student));
    assert.strictEqual(letterRes.status, 403);
  });

  test('student cannot download another student submission', async (t) => {
    if (!dbReady || !migrationsReady || !fixtures) {
      return t.skip('DATABASE_URL unavailable, migrations missing, or fixtures incomplete');
    }
    if (!ctx.submissionId) return t.skip('workflow test did not complete');
    const { specialty } = fixtures;
    const other = await prisma.users.create({
      data: {
        email: `ft-other-${Date.now()}@batuni.edu`,
        full_name: 'Other Student',
        password_hash: 'x',
        status: 'active',
        primary_university_id: fixtures.admin.primary_university_id,
        specialty_id: specialty.id,
      },
    });
    ctx.otherStudentId = other.id;
    const studentRole = await prisma.roles.findFirst({ where: { code: 'student' } });
    await prisma.user_roles.create({ data: { user_id: other.id, role_id: studentRole.id } });

    const res = await request(app)
      .get(`/api/v1/student/field-training/submissions/${ctx.submissionId}/download`)
      .set('Authorization', bearerForUser(other));
    assert.strictEqual(res.status, 403);
  });

  test('instructor cannot manage unassigned training opportunity', async (t) => {
    if (!dbReady || !migrationsReady || !fixtures) {
      return t.skip('DATABASE_URL unavailable, migrations missing, or fixtures incomplete');
    }
    const { instructor, specialty, admin } = fixtures;
    const createRes = await request(app)
      .post('/api/v1/admin/field-training')
      .set('Authorization', bearerForUser(admin))
      .send({
        title: `FT Unassigned ${Date.now()}`,
        specialty_id: specialty.id,
        location: 'عمان',
        training_mode: 'remote',
        description: 'فرصة بدون مدرب معين للاختبار الأمني.',
      });
    assert.strictEqual(createRes.status, 201);
    const unassignedId = createRes.body.data.opportunity.id;

    try {
      const res = await request(app)
        .post(`/api/v1/instructor/field-training/${unassignedId}/sessions`)
        .set('Authorization', bearerForUser(instructor))
        .send({
          title: 'جلسة',
          session_date: tomorrowDateOnly(),
          start_time: '09:00',
          end_time: '10:00',
        });
      assert.strictEqual(res.status, 403);
    } finally {
      await cleanupOpportunity(unassignedId);
    }
  });
});

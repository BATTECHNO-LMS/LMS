'use strict';

/**
 * Controlled Full-Stack HTTP lifecycle against a running API + database.
 * Usage: node scripts/run-institution-training-lifecycle.js
 *
 * Env:
 *   API_BASE=http://localhost:4000
 *   SUPER_EMAIL / SUPER_PASSWORD
 *   TRAINER_EMAIL / TRAINER_PASSWORD
 *   TRAINEE_EMAIL / TRAINEE_PASSWORD
 */

const API_BASE = process.env.API_BASE || 'http://localhost:4000';
const SUPER = {
  email: process.env.SUPER_EMAIL || 'superadmin@batuni.edu',
  password: process.env.SUPER_PASSWORD || '12345678',
};
const TRAINER = {
  email: process.env.TRAINER_EMAIL || 'trainer.cpf@demo.local',
  password: process.env.TRAINER_PASSWORD || '12345678',
};
const TRAINEE = {
  email: process.env.TRAINEE_EMAIL || 'trainee.cpf@demo.local',
  password: process.env.TRAINEE_PASSWORD || '12345678',
};

const steps = [];

function record(name, status, detail = {}) {
  const { status: _ignored, ...safeDetail } = detail;
  steps.push({ name, result: status, ...safeDetail });
  const mark = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '○';
  console.log(`${mark} [${status}] ${name}${detail.message ? ` — ${detail.message}` : ''}`);
}

async function req(method, path, { token, body, portalType } = {}) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (portalType) headers['X-Portal-Type'] = portalType;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json, data: json?.data ?? json };
}

async function login(account, portalType) {
  const res = await req('POST', '/api/auth/login', {
    body: { email: account.email, password: account.password, portalType },
  });
  const token = res.data?.token || res.json?.data?.token;
  if (res.status >= 400 || !token) {
    throw new Error(`login failed ${res.status}: ${res.json?.message || res.json?.error || 'no token'}`);
  }
  return token;
}

async function main() {
  console.log(`API_BASE=${API_BASE}`);
  const ids = {};

  // 1 health
  try {
    const health = await req('GET', '/health');
    if (health.status === 200 && (health.json?.database === 'connected' || health.json?.status === 'ok')) {
      record('Backend health', 'PASS', { response: health.json });
    } else {
      record('Backend health', 'FAIL', { status: health.status, response: health.json });
      process.exitCode = 1;
      return;
    }
  } catch (e) {
    record('Backend health', 'FAIL', { message: e.message });
    process.exitCode = 1;
    return;
  }

  let superToken;
  let trainerToken;
  let traineeToken;
  try {
    superToken = await login(SUPER);
    record('Super Admin login', 'PASS');
  } catch (e) {
    record('Super Admin login', 'FAIL', { message: e.message });
    process.exitCode = 1;
    return;
  }

  try {
    trainerToken = await login(TRAINER, 'INSTITUTION');
    record('Trainer login', 'PASS');
  } catch (e) {
    record('Trainer login', 'FAIL', { message: e.message });
  }

  try {
    traineeToken = await login(TRAINEE, 'INSTITUTION');
    record('Trainee login', 'PASS');
  } catch (e) {
    record('Trainee login', 'FAIL', { message: e.message });
  }

  // Resolve institution + user ids via orgs/me
  const orgs = await req('GET', '/api/v1/organizations?type=INSTITUTION', { token: superToken });
  const institutions = Array.isArray(orgs.data) ? orgs.data : [];
  const institution =
    institutions.find((o) => /ولي العهد|Crown|CROWN/i.test(`${o.name} ${o.code || ''}`)) ||
    institutions[0];
  if (!institution) {
    record('Resolve institution', 'FAIL', { message: 'No INSTITUTION organizations found' });
    process.exitCode = 1;
    return;
  }
  ids.organizationId = institution.id;
  record('Resolve institution', 'PASS', { message: `${institution.name} (${institution.id})` });

  const meTrainer = trainerToken
    ? await req('GET', '/api/auth/me', { token: trainerToken })
    : { data: null };
  const meTrainee = traineeToken
    ? await req('GET', '/api/auth/me', { token: traineeToken })
    : { data: null };
  ids.trainerUserId = meTrainer.data?.id || meTrainer.data?.user?.id;
  ids.traineeUserId = meTrainee.data?.id || meTrainee.data?.user?.id;
  if (!ids.trainerUserId || !ids.traineeUserId) {
    // fallback: org members
    const trainers = await req('GET', `/api/v1/organizations/${ids.organizationId}/members?role_code=trainer`, {
      token: superToken,
    });
    const trainees = await req('GET', `/api/v1/organizations/${ids.organizationId}/members?role_code=trainee`, {
      token: superToken,
    });
    ids.trainerUserId = ids.trainerUserId || (Array.isArray(trainers.data) ? trainers.data[0]?.userId : null);
    ids.traineeUserId = ids.traineeUserId || (Array.isArray(trainees.data) ? trainees.data[0]?.userId : null);
  }
  if (!ids.trainerUserId || !ids.traineeUserId) {
    record('Resolve trainer/trainee users', 'FAIL', {
      message: 'Seed demo users missing. Run: node scripts/seed-institution-demo-users.js',
    });
    process.exitCode = 1;
    return;
  }
  record('Resolve trainer/trainee users', 'PASS', {
    message: `trainer=${ids.trainerUserId} trainee=${ids.traineeUserId}`,
  });

  // Create course
  const courseBody = {
    title: `دورة تجريبية لاختبار دورة العمل ${Date.now()}`,
    description: 'دورة Full-Stack للتحقق من دورة العمل الكاملة',
    short_description: 'دورة تجريبية',
    field: 'تدريب مؤسسي',
    level: 'beginner',
    language: 'ar',
    objectives: 'التحقق من الربط الكامل بين الأدوار الثلاثة',
    outcomes: 'إكمال الجلسات والمهمات والاختبارات والحصول على شهادة',
    delivery_mode: 'hybrid',
    required_hours: 2,
    required_attendance_pct: 50,
    max_participants: 30,
    requires_pre_test: true,
    requires_post_test: true,
    requires_tasks: true,
    pass_score: 50,
    status: 'DRAFT',
  };
  const created = await req('POST', `/api/v1/training/organizations/${ids.organizationId}/programs`, {
    token: superToken,
    body: courseBody,
  });
  if (created.status >= 400 || !created.data?.id) {
    record('Create course', 'FAIL', {
      status: created.status,
      message: created.json?.message || JSON.stringify(created.json),
    });
    process.exitCode = 1;
    return;
  }
  ids.programId = created.data.id;
  if (created.data.type && created.data.type !== 'TRAINING_COURSE') {
    record('Create course type', 'FAIL', { message: `type=${created.data.type}` });
  } else {
    record('Create course', 'PASS', { message: ids.programId });
  }

  // Cohort
  const cohort = await req('POST', `/api/v1/training/programs/${ids.programId}/cohorts`, {
    token: superToken,
    body: {
      name: 'الدفعة التجريبية الأولى',
      capacity: 30,
      status: 'OPEN',
      start_date: new Date().toISOString().slice(0, 10),
      end_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    },
  });
  if (cohort.status >= 400 || !cohort.data?.id) {
    record('Create cohort', 'FAIL', { status: cohort.status, message: cohort.json?.message });
    process.exitCode = 1;
    return;
  }
  ids.cohortId = cohort.data.id;
  record('Create cohort', 'PASS', { message: ids.cohortId });

  // Assign trainer
  const assign = await req('POST', `/api/v1/training/organizations/${ids.organizationId}/trainer-assignments`, {
    token: superToken,
    body: {
      trainer_user_id: ids.trainerUserId,
      training_program_id: ids.programId,
      training_cohort_id: ids.cohortId,
      is_lead_trainer: true,
    },
  });
  if (assign.status >= 400 || !assign.data?.id) {
    record('Assign trainer', 'FAIL', { status: assign.status, message: assign.json?.message });
  } else {
    ids.assignmentId = assign.data.id;
    record('Assign trainer', 'PASS', { message: ids.assignmentId });
  }

  // Enroll trainee
  const enroll = await req('POST', `/api/v1/training/cohorts/${ids.cohortId}/enrollments`, {
    token: superToken,
    body: { user_id: ids.traineeUserId, status: 'ACTIVE' },
  });
  if (enroll.status >= 400 || !enroll.data?.id) {
    record('Enroll trainee', 'FAIL', { status: enroll.status, message: enroll.json?.message });
  } else {
    ids.enrollmentId = enroll.data.id;
    record('Enroll trainee', 'PASS', { message: ids.enrollmentId });
  }

  // Publish
  const publish = await req('POST', `/api/v1/training/programs/${ids.programId}/publish`, {
    token: superToken,
  });
  record(
    'Publish course',
    publish.status < 400 && publish.data?.status === 'PUBLISHED' ? 'PASS' : 'FAIL',
    { status: publish.status, message: publish.json?.message || publish.data?.status }
  );

  // Trainer sees course
  if (trainerToken) {
    const trainerCourses = await req('GET', '/api/v1/training/trainer/courses', { token: trainerToken });
    const list = Array.isArray(trainerCourses.data)
      ? trainerCourses.data
      : trainerCourses.data?.items || [];
    const seen = list.some((c) => String(c.id || c.programId || c.program?.id) === String(ids.programId));
    record('Trainer course list contains program', seen ? 'PASS' : 'FAIL', {
      status: trainerCourses.status,
      message: `count=${list.length}`,
    });
  } else {
    record('Trainer course list contains program', 'BLOCKED', { message: 'trainer login failed' });
  }

  // Trainee sees course
  if (traineeToken) {
    const mine = await req('GET', '/api/v1/training/trainee/my-programs', { token: traineeToken });
    const rows = Array.isArray(mine.data) ? mine.data : [];
    const seen = rows.some((r) => String(r.programId) === String(ids.programId));
    record('Trainee my-programs contains course', seen ? 'PASS' : 'FAIL', {
      status: mine.status,
      message: `count=${rows.length}`,
    });
  } else {
    record('Trainee my-programs contains course', 'BLOCKED', { message: 'trainee login failed' });
  }

  // Configure assessments
  const pre = await req('PUT', `/api/v1/training/programs/${ids.programId}/assessments/pre`, {
    token: superToken,
    body: {
      title: 'اختبار قبلي تجريبي',
      duration_minutes: 20,
      max_attempts: 2,
      pass_score: 50,
      is_published: true,
      questions: [
        {
          prompt: 'هل أنت جاهز؟',
          question_type: 'single_choice',
          options_json: ['نعم', 'لا'],
          correct_answer: 'نعم',
          points: 100,
        },
      ],
    },
  });
  record('Configure pre-test', pre.status < 400 ? 'PASS' : 'FAIL', {
    status: pre.status,
    message: pre.json?.message,
  });
  ids.preAssessmentId = pre.data?.id;

  const post = await req('PUT', `/api/v1/training/programs/${ids.programId}/assessments/post`, {
    token: superToken,
    body: {
      title: 'اختبار بعدي تجريبي',
      duration_minutes: 20,
      max_attempts: 2,
      pass_score: 50,
      is_published: true,
      questions: [
        {
          prompt: 'هل أكملت المتطلبات؟',
          question_type: 'single_choice',
          options_json: ['نعم', 'لا'],
          correct_answer: 'نعم',
          points: 100,
        },
      ],
    },
  });
  record('Configure post-test', post.status < 400 ? 'PASS' : 'FAIL', {
    status: post.status,
    message: post.json?.message,
  });
  ids.postAssessmentId = post.data?.id;

  // Material
  const material = await req('POST', `/api/v1/training/programs/${ids.programId}/materials`, {
    token: superToken,
    body: {
      title: 'مادة تجريبية',
      url: 'https://example.com/material',
      material_type: 'LINK',
      is_published: true,
    },
  });
  record('Create material', material.status < 400 ? 'PASS' : 'FAIL', {
    status: material.status,
    message: material.json?.message || material.data?.id,
  });

  // Session via trainer (or super)
  const actorToken = trainerToken || superToken;
  const starts = new Date(Date.now() + 3600000);
  const ends = new Date(Date.now() + 7200000);
  const session = await req('POST', `/api/v1/training/cohorts/${ids.cohortId}/sessions`, {
    token: actorToken,
    body: {
      title: 'جلسة تجريبية',
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      hours: 2,
      location: 'قاعة التدريب',
      attendance_required: true,
      counts_toward_hours: true,
      status: 'SCHEDULED',
    },
  });
  if (session.status >= 400 || !session.data?.id) {
    record('Create session', 'FAIL', { status: session.status, message: session.json?.message });
  } else {
    ids.sessionId = session.data.id;
    record('Create session', 'PASS', { message: ids.sessionId });
  }

  // Attendance window
  let attendanceCode = null;
  if (ids.sessionId) {
    const win = await req('POST', `/api/v1/training/sessions/${ids.sessionId}/attendance-window`, {
      token: actorToken,
      body: { duration_seconds: 600, late_seconds: 300 },
    });
    if (win.status < 400 && win.data?.code) {
      attendanceCode = win.data.code;
      record('Open attendance window', 'PASS', { message: `code=${attendanceCode}` });
    } else {
      record('Open attendance window', 'FAIL', { status: win.status, message: win.json?.message });
    }
  } else {
    record('Open attendance window', 'BLOCKED');
  }

  // Task
  const task = await req('POST', `/api/v1/training/programs/${ids.programId}/tasks`, {
    token: actorToken,
    body: {
      title: 'مهمة تجريبية',
      instructions: 'أرسل ملخصًا قصيرًا',
      publish: true,
      is_required: true,
      max_score: 100,
    },
  });
  if (task.status >= 400 || !task.data?.id) {
    record('Create task', 'FAIL', { status: task.status, message: task.json?.message });
  } else {
    ids.taskId = task.data.id;
    record('Create task', 'PASS', { message: ids.taskId });
  }

  // Trainee actions
  if (traineeToken && ids.preAssessmentId) {
    const assessments = await req('GET', `/api/v1/training/programs/${ids.programId}/assessments`, {
      token: traineeToken,
    });
    const preRow = (Array.isArray(assessments.data) ? assessments.data : []).find(
      (a) => a.kind === 'PRE_TEST'
    );
    // Need question ids — fetch trainee detail
    const detail = await req('GET', `/api/v1/training/trainee/programs/${ids.programId}`, {
      token: traineeToken,
    });
    if (detail.status >= 400) {
      record('Trainee program detail', 'FAIL', { status: detail.status, message: detail.json?.message });
    } else {
      record('Trainee program detail', 'PASS');
      const preAssess = (detail.data?.assessments || []).find((a) => a.kind === 'PRE_TEST');
      const q = preAssess?.questions?.[0];
      if (preAssess && q) {
        const attempt = await req('POST', `/api/v1/training/assessments/${preAssess.id}/attempts`, {
          token: traineeToken,
          body: { answers: { [q.id]: 'نعم' } },
        });
        record('Trainee submit pre-test', attempt.status < 400 ? 'PASS' : 'FAIL', {
          status: attempt.status,
          message: attempt.json?.message || `score=${attempt.data?.score}`,
        });
      } else {
        record('Trainee submit pre-test', 'BLOCKED', { message: 'no published pre-test questions' });
      }
    }
  } else {
    record('Trainee submit pre-test', 'BLOCKED');
  }

  if (traineeToken && ids.sessionId && attendanceCode) {
    const confirm = await req('POST', `/api/v1/training/sessions/${ids.sessionId}/attendance/confirm`, {
      token: traineeToken,
      body: { code: attendanceCode },
    });
    record('Trainee confirm attendance', confirm.status < 400 ? 'PASS' : 'FAIL', {
      status: confirm.status,
      message: confirm.json?.message || confirm.data?.status,
      code: confirm.json?.code,
    });
  } else {
    record('Trainee confirm attendance', 'BLOCKED');
  }

  if (traineeToken && ids.taskId) {
    const submission = await req('POST', `/api/v1/training/tasks/${ids.taskId}/submissions`, {
      token: traineeToken,
      body: { content_text: 'تسليم تجريبي لدورة العمل' },
    });
    if (submission.status < 400 && submission.data?.id) {
      ids.submissionId = submission.data.id;
      record('Trainee submit task', 'PASS', { message: ids.submissionId });
    } else {
      record('Trainee submit task', 'FAIL', {
        status: submission.status,
        message: submission.json?.message,
      });
    }
  } else {
    record('Trainee submit task', 'BLOCKED');
  }

  if (actorToken && ids.submissionId) {
    const grade = await req('POST', `/api/v1/training/submissions/${ids.submissionId}/grade`, {
      token: actorToken,
      body: { score: 90, feedback: 'ممتاز', status: 'GRADED' },
    });
    record('Trainer grade task', grade.status < 400 ? 'PASS' : 'FAIL', {
      status: grade.status,
      message: grade.json?.message || `score=${grade.data?.score}`,
    });
  } else {
    record('Trainer grade task', 'BLOCKED');
  }

  if (traineeToken) {
    const detail2 = await req('GET', `/api/v1/training/trainee/programs/${ids.programId}`, {
      token: traineeToken,
    });
    const postAssess = (detail2.data?.assessments || []).find((a) => a.kind === 'POST_TEST');
    const q = postAssess?.questions?.[0];
    if (postAssess && q) {
      const attempt = await req('POST', `/api/v1/training/assessments/${postAssess.id}/attempts`, {
        token: traineeToken,
        body: { answers: { [q.id]: 'نعم' } },
      });
      record('Trainee submit post-test', attempt.status < 400 ? 'PASS' : 'FAIL', {
        status: attempt.status,
        message: attempt.json?.message || `score=${attempt.data?.score}`,
      });
    } else {
      record('Trainee submit post-test', 'BLOCKED', { message: 'no post-test questions' });
    }

    const statusRes = await req('GET', `/api/v1/training/programs/${ids.programId}/assessment-status`, {
      token: traineeToken,
    });
    record('Trainee assessment-status', statusRes.status < 400 ? 'PASS' : 'FAIL', {
      status: statusRes.status,
      message: `count=${statusRes.data?.assessments?.length ?? 0}`,
    });

    const cmp = await req('GET', `/api/v1/training/programs/${ids.programId}/pre-post-comparison`, {
      token: traineeToken,
    });
    const item = cmp.data?.items?.[0];
    record('Trainee pre/post comparison', cmp.status < 400 && item ? 'PASS' : 'FAIL', {
      status: cmp.status,
      message: item
        ? `pre=${item.preScore} post=${item.postScore} diff=${item.difference}`
        : cmp.json?.message,
    });
  }

  if (ids.enrollmentId) {
    const progress = await req('POST', `/api/v1/training/enrollments/${ids.enrollmentId}/progress/recompute`, {
      token: superToken,
    });
    record('Recompute progress', progress.status < 400 ? 'PASS' : 'FAIL', {
      status: progress.status,
      message: `pct=${progress.data?.completionPct} status=${progress.data?.status}`,
    });

    const complete = await req('POST', `/api/v1/training/enrollments/${ids.enrollmentId}/complete`, {
      token: superToken,
    });
    record('Approve completion', complete.status < 400 ? 'PASS' : 'FAIL', {
      status: complete.status,
      message: complete.json?.message || complete.data?.status,
      code: complete.json?.code,
    });

    const cert = await req('POST', `/api/v1/training/enrollments/${ids.enrollmentId}/certificate`, {
      token: superToken,
    });
    if (cert.status < 400 && cert.data?.verificationCode) {
      ids.verificationCode = cert.data.verificationCode;
      record('Issue certificate', 'PASS', {
        message: `${cert.data.certificateNumber}`,
      });
      const verify = await req('GET', `/api/v1/training/certificates/verify/${ids.verificationCode}`);
      record('Public verify certificate', verify.data?.valid ? 'PASS' : 'FAIL', {
        status: verify.status,
        message: JSON.stringify(verify.data),
      });
    } else {
      record('Issue certificate', 'FAIL', {
        status: cert.status,
        message: cert.json?.message,
        code: cert.json?.code,
      });
      record('Public verify certificate', 'BLOCKED');
    }

    if (traineeToken) {
      const getCert = await req('GET', `/api/v1/training/enrollments/${ids.enrollmentId}/certificate`, {
        token: traineeToken,
      });
      record('Trainee retrieve certificate', getCert.status < 400 ? 'PASS' : 'FAIL', {
        status: getCert.status,
        message: getCert.json?.message || getCert.data?.certificateNumber,
      });
    }
  }

  console.log('\n=== IDs ===');
  console.log(JSON.stringify(ids, null, 2));
  console.log('\n=== SUMMARY ===');
  const counts = steps.reduce(
    (acc, s) => {
      acc[s.result] = (acc[s.result] || 0) + 1;
      return acc;
    },
    {}
  );
  console.log(counts);
  const failed = steps.filter((s) => s.result === 'FAIL');
  if (failed.length) {
    process.exitCode = 1;
    console.log('\nFailed steps:');
    for (const f of failed) console.log(`- ${f.name}: ${f.message || ''}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

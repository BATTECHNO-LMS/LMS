/**
 * QA smoke test for courses module.
 * Run: node scripts/test-courses-api.js
 * Requires API on PORT (default 4000) and seeded users.
 */
const BASE = `http://127.0.0.1:${process.env.PORT || 4000}`;

const SUPER = { email: 'superadmin@batuni.edu', password: '12345678' };
const STUDENT = { email: 'ahmed2000@gmail.com', password: 'Ahmed2000' };
const INSTRUCTOR = { email: 'instructor@batuni.edu', password: '12345678' };

async function req(method, path, { token, body } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

async function login(creds) {
  const r = await req('POST', '/api/auth/login', { body: creds });
  if (r.status !== 200 || !r.json?.data?.token) {
    throw new Error(`Login failed ${creds.email}: ${r.status} ${JSON.stringify(r.json)}`);
  }
  return r.json.data.token;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const results = [];
  const log = (name, ok, detail = '') => {
    results.push({ name, ok, detail });
    // eslint-disable-next-line no-console
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  };

  let superToken;
  let studentToken;
  let instructorToken;
  try {
    superToken = await login(SUPER);
    studentToken = await login(STUDENT);
    instructorToken = await login(INSTRUCTOR);
    log('login tokens', true);
  } catch (e) {
    log('login tokens', false, e.message);
    process.exitCode = 1;
    return;
  }

  // Permissions: instructor cannot list admin courses
  const instAdmin = await req('GET', '/api/v1/admin/courses', { token: instructorToken });
  log('instructor blocked from admin courses', instAdmin.status === 403, `status ${instAdmin.status}`);

  const stuAdmin = await req('GET', '/api/v1/admin/courses', { token: studentToken });
  log('student blocked from admin courses', stuAdmin.status === 403, `status ${stuAdmin.status}`);

  // Create draft course
  const title = `QA Course ${Date.now()}`;
  const create = await req('POST', '/api/v1/admin/courses', {
    token: superToken,
    body: {
      title,
      short_description: 'Short desc',
      description: 'Full description for QA testing course module.',
      level: 'beginner',
    },
  });
  const courseId = create.json?.data?.course?.id;
  log('admin create course', create.status === 201 && courseId, create.status);

  // Publish should fail readiness
  const pubFail = await req('POST', `/api/v1/admin/courses/${courseId}/publish`, { token: superToken });
  log(
    'publish fails without lessons',
    pubFail.status === 400 && pubFail.json?.code === 'COURSE_PUBLISH_READINESS',
    pubFail.json?.code
  );

  const sec = await req('POST', `/api/v1/admin/courses/${courseId}/sections`, {
    token: superToken,
    body: { title: 'Section 1' },
  });
  const sectionId = sec.json?.data?.section?.id;
  log('create section', sec.status === 201 && sectionId, sec.status);

  const lesson = await req('POST', `/api/v1/admin/courses/${courseId}/sections/${sectionId}/lessons`, {
    token: superToken,
    body: {
      title: 'Intro video',
      type: 'video',
      video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    },
  });
  const lessonId = lesson.json?.data?.lesson?.id;
  log('create lesson', lesson.status === 201 && lessonId, lesson.status);

  const structure = await req('GET', `/api/v1/admin/courses/${courseId}/structure`, { token: superToken });
  log('get structure', structure.status === 200 && structure.json?.data?.sections?.length >= 1, structure.status);

  const pubOk = await req('POST', `/api/v1/admin/courses/${courseId}/publish`, { token: superToken });
  log('publish course', pubOk.status === 200 && pubOk.json?.data?.course?.status === 'published', pubOk.status);

  // Student cannot see draft - create another draft
  const draft2 = await req('POST', '/api/v1/admin/courses', {
    token: superToken,
    body: {
      title: `Draft Only ${Date.now()}`,
      description: 'Another draft course hidden from students.',
    },
  });
  const draftId = draft2.json?.data?.course?.id;
  const stuList = await req('GET', '/api/v1/student/courses', { token: studentToken });
  const ids = (stuList.json?.data?.courses ?? []).map((c) => c.id);
  log('student list excludes draft', !ids.includes(draftId), `draft ${draftId}`);

  const stuDraftGet = await req('GET', `/api/v1/student/courses/${draftId}`, { token: studentToken });
  log('student cannot get draft by id', stuDraftGet.status === 404, stuDraftGet.status);

  // Published course flow
  const stuGet = await req('GET', `/api/v1/student/courses/${courseId}`, { token: studentToken });
  const lessonStatuses = (stuGet.json?.data?.sections ?? []).flatMap((s) => s.lessons.map((l) => l.status));
  log('student sees published lessons only', lessonStatuses.every((s) => s === 'published'), lessonStatuses.join());

  const start = await req('POST', `/api/v1/student/courses/${courseId}/start`, { token: studentToken });
  log('start course', start.status === 201 || start.status === 200, start.status);

  const progBefore = await req('GET', `/api/v1/student/courses/${courseId}/progress`, { token: studentToken });
  log('progress before complete', progBefore.status === 200, progBefore.status);

  const complete = await req('POST', `/api/v1/student/courses/${courseId}/lessons/${lessonId}/complete`, {
    token: studentToken,
  });
  log('complete lesson', complete.status === 200, complete.status);

  const progAfter = await req('GET', `/api/v1/student/courses/${courseId}/progress`, { token: studentToken });
  log(
    'progress after complete',
    progAfter.json?.data?.progress_percent >= 100 || progAfter.json?.data?.completed_lesson_ids?.includes(lessonId),
    String(progAfter.json?.data?.progress_percent)
  );

  // Archive - student should not see
  await req('POST', `/api/v1/admin/courses/${courseId}/archive`, { token: superToken });
  const stuArchived = await req('GET', `/api/v1/student/courses/${courseId}`, { token: studentToken });
  log('student cannot get archived', stuArchived.status === 404, stuArchived.status);

  // Update course
  const patch = await req('PATCH', `/api/v1/admin/courses/${courseId}`, {
    token: superToken,
    body: { short_description: 'Updated short' },
  });
  log('patch course', patch.status === 200, patch.status);

  const list = await req('GET', '/api/v1/admin/courses?page=1&page_size=10', { token: superToken });
  log('admin list', list.status === 200 && Array.isArray(list.json?.data?.courses), list.status);

  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    process.exitCode = 1;
    // eslint-disable-next-line no-console
    console.error('\nFailed:', failed);
  } else {
    // eslint-disable-next-line no-console
    console.log('\nAll course API checks passed.');
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exitCode = 1;
});

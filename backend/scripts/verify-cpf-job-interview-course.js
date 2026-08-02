'use strict';

const API_BASE = process.env.API_BASE || 'http://localhost:4000';
const COURSE_CODE = 'CPF-JOB-INTERVIEW-2026-08';
const PROGRAM_ID = process.env.PROGRAM_ID || 'f7f07396-8118-4fe1-906c-006e6133706f';

async function req(method, path, { token, body, portalType } = {}) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (portalType) headers['X-Portal-Type'] = portalType;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json, data: json?.data ?? json };
}

async function login(email, password, portalType) {
  const body = { email, password };
  if (portalType) body.portalType = portalType;
  const res = await req('POST', '/api/auth/login', { body });
  const token = res.data?.token || res.json?.data?.token || null;
  if (!token && portalType) {
    // fallback without portalType for global accounts
    const retry = await req('POST', '/api/auth/login', { body: { email, password } });
    return retry.data?.token || retry.json?.data?.token || null;
  }
  return token;
}

async function main() {
  const out = [];
  const superToken = await login(
    process.env.SUPER_EMAIL || 'superadmin@batuni.edu',
    process.env.SUPER_PASSWORD || '12345678'
  );
  out.push({ step: 'super_login', ok: Boolean(superToken) });

  const courses = await req('GET', '/api/v1/training/courses', { token: superToken });
  const list = Array.isArray(courses.data) ? courses.data : [];
  const course = list.find((c) => c.code === COURSE_CODE || c.id === PROGRAM_ID);
  out.push({
    step: 'super_admin_sees_course',
    ok: Boolean(course),
    title: course?.title,
    status: course?.status,
    code: course?.code,
  });

  const detail = await req('GET', `/api/v1/training/programs/${PROGRAM_ID}`, { token: superToken });
  out.push({
    step: 'super_admin_course_detail',
    ok: detail.status < 400 && detail.data?.title === 'اجتياز مقابلات العمل',
    status: detail.status,
    code: detail.data?.code,
    requiresPreTest: detail.data?.requiresPreTest,
    requiresPostTest: detail.data?.requiresPostTest,
    trainerCount: detail.data?.trainerCount,
  });

  const assessments = await req('GET', `/api/v1/training/programs/${PROGRAM_ID}/assessments`, {
    token: superToken,
  });
  const pre = (Array.isArray(assessments.data) ? assessments.data : []).find((a) => a.kind === 'PRE_TEST');
  out.push({
    step: 'pre_test_visible',
    ok: Boolean(pre?.isPublished) && (pre?.questionCount === 20 || pre?.questions?.length === 20),
    questionCount: pre?.questionCount ?? pre?.questions?.length,
    code: pre?.code,
  });

  const trainerToken = await login(
    process.env.TRAINER_EMAIL || 'trainer.cpf@demo.local',
    process.env.TRAINER_PASSWORD || '12345678',
    'institution'
  );
  const trainerCourses = await req('GET', '/api/v1/training/trainer/courses', { token: trainerToken });
  const trainerList = Array.isArray(trainerCourses.data)
    ? trainerCourses.data
    : Array.isArray(trainerCourses.data?.items)
      ? trainerCourses.data.items
      : [];
  const trainerSees = trainerList.some((c) => c.id === PROGRAM_ID || c.programId === PROGRAM_ID);
  out.push({
    step: 'trainer_without_assignment_hidden',
    ok: !trainerSees,
    count: trainerList.length,
  });

  const traineeToken = await login(
    process.env.TRAINEE_EMAIL || 'trainee.cpf@demo.local',
    process.env.TRAINEE_PASSWORD || '12345678',
    'institution'
  );
  const traineeDetail = await req('GET', `/api/v1/training/trainee/programs/${PROGRAM_ID}`, {
    token: traineeToken,
  });
  out.push({
    step: 'trainee_unenrolled_blocked',
    ok: traineeDetail.status >= 400,
    status: traineeDetail.status,
    code: traineeDetail.json?.code,
  });

  console.log(JSON.stringify(out, null, 2));
  if (out.some((r) => !r.ok)) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

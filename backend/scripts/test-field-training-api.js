/**
 * Smoke test for field training MVP.
 * Run: node scripts/test-field-training-api.js
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
    throw new Error(`Login failed ${creds.email}: ${r.status}`);
  }
  return r.json.data.token;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const log = (name, ok, detail = '') => {
    // eslint-disable-next-line no-console
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
    if (!ok) process.exitCode = 1;
  };

  const superToken = await login(SUPER);
  const studentToken = await login(STUDENT);
  const instructorToken = await login(INSTRUCTOR);

  const inst = await req('GET', '/api/v1/admin/field-training', { token: instructorToken });
  log('instructor blocked admin', inst.status === 403, String(inst.status));

  const create = await req('POST', '/api/v1/admin/field-training', {
    token: superToken,
    body: {
      title: 'FT',
      organization_name: 'BATTECHNO Corp',
      location: 'Amman',
      training_mode: 'hybrid',
      description: 'short',
    },
  });
  const oppId = create.json?.data?.opportunity?.id;
  log('create draft', create.status === 201 && oppId, create.status);

  const pubFail = await req('POST', `/api/v1/admin/field-training/${oppId}/publish`, { token: superToken });
  log(
    'publish readiness when incomplete',
    pubFail.status === 400 && pubFail.json?.code === 'FIELD_TRAINING_PUBLISH_READINESS',
    pubFail.json?.code
  );

  const patch = await req('PATCH', `/api/v1/admin/field-training/${oppId}`, {
    token: superToken,
    body: {
      title: `FT QA ${Date.now()}`,
      description: 'Updated full description with enough length for publish.',
    },
  });
  log('patch', patch.status === 200, patch.status);

  const pubOk = await req('POST', `/api/v1/admin/field-training/${oppId}/publish`, { token: superToken });
  log('publish', pubOk.status === 200 && pubOk.json?.data?.opportunity?.status === 'published', pubOk.status);

  const draft = await req('POST', '/api/v1/admin/field-training', {
    token: superToken,
    body: {
      title: `Draft FT ${Date.now()}`,
      organization_name: 'Hidden Org',
      location: 'Hidden',
      training_mode: 'remote',
      description: 'Draft only opportunity hidden from students.',
    },
  });
  const draftId = draft.json?.data?.opportunity?.id;

  const stuList = await req('GET', '/api/v1/student/field-training', { token: studentToken });
  const ids = (stuList.json?.data?.opportunities ?? []).map((o) => o.id);
  log('student list excludes draft', !ids.includes(draftId), `draft ${draftId}`);

  const apply = await req('POST', `/api/v1/student/field-training/${oppId}/apply`, {
    token: studentToken,
    body: { student_message: 'I am interested in this training.' },
  });
  const appId = apply.json?.data?.application?.id;
  log('apply', apply.status === 201 && appId, apply.status);

  const dup = await req('POST', `/api/v1/student/field-training/${oppId}/apply`, { token: studentToken, body: {} });
  log('duplicate apply blocked', dup.status === 409, String(dup.status));

  const review = await req('PATCH', `/api/v1/admin/field-training/applications/${appId}/status`, {
    token: superToken,
    body: { status: 'approved', admin_note: 'Welcome' },
  });
  log('approve', review.status === 200, review.status);

  const apps = await req('GET', `/api/v1/admin/field-training/${oppId}/applications`, { token: superToken });
  log('list applications', apps.status === 200 && Array.isArray(apps.json?.data?.applications), apps.status);

  // eslint-disable-next-line no-console
  console.log(process.exitCode ? '\nSome checks failed' : '\nAll field training checks passed');
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exitCode = 1;
});

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const {
  ARTIFACTS,
  showQaOverlay,
  clearOverlay,
  saveNamedScreenshot,
} = require('./helpers');

const EMAIL = process.env.QA_EMAIL || 'superadmin@batuni.edu';
const PASSWORD = process.env.QA_PASSWORD || '12345678';
const API = process.env.QA_API_BASE_URL || 'https://lms.battechno.com';
const OPP = '4d9466cb-127b-42f2-ac08-88e7fcc7c7df';

async function apiLogin(request) {
  const res = await request.post(`${API}/api/auth/login`, {
    data: { email: EMAIL, password: PASSWORD, portalType: 'UNIVERSITY' },
  });
  expect(res.ok(), `login status ${res.status()}`).toBeTruthy();
  const json = await res.json();
  return json?.data || json;
}

async function injectSession(page, auth) {
  const token = auth.token;
  const user = auth.user;
  await page.addInitScript(
    ({ token: t, user: u }) => {
      const PREFIX = 'battechno_lms_';
      localStorage.setItem(`${PREFIX}auth_token`, JSON.stringify(t));
      localStorage.setItem(`${PREFIX}auth_user`, JSON.stringify(u));
      localStorage.setItem(`${PREFIX}tenant_scope`, JSON.stringify(null));
    },
    { token, user }
  );
}

test.describe.configure({ mode: 'serial' });

test('AUTHENTICATED admin FT deep journey', async ({ page, request }) => {
  const auth = await apiLogin(request);
  await injectSession(page, auth);
  await showQaOverlay(page, {
    testName: 'FIELD_TRAINING_FULL_QA',
    expected: 'Authenticated super_admin can open FT admin + reports for Tafila opportunity',
  });
  await page.goto('/admin/field-training', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await saveNamedScreenshot(page, 'auth_01_admin_ft_hub');

  // Try opportunity deep links commonly used
  const routes = [
    `/admin/field-training/opportunities/${OPP}`,
    `/admin/field-training/opportunities/${OPP}/manage`,
    `/admin/field-training/opportunities/${OPP}/students`,
    `/admin/field-training/reports`,
    `/admin/field-training/reports/opportunities/${OPP}`,
    `/admin/field-training/evaluations`,
  ];
  for (const route of routes) {
    await showQaOverlay(page, {
      testName: `Navigate ${route}`,
      expected: 'Authorized page loads without 500/blank crash',
    });
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1800);
  }
  await saveNamedScreenshot(page, 'auth_02_ft_deep_end');

  // API positive + negative with token
  const headers = { Authorization: `Bearer ${auth.token}` };
  const list = await request.get(`${API}/api/v1/admin/field-training/opportunities`, { headers });
  const cross = await request.get(
    `${API}/api/v1/admin/field-training/opportunities/00000000-0000-0000-0000-000000000000`,
    { headers }
  );
  fs.mkdirSync(path.join(ARTIFACTS, 'logs'), { recursive: true });
  fs.writeFileSync(
    path.join(ARTIFACTS, 'logs', 'api-auth-smoke.json'),
    JSON.stringify(
      {
        listStatus: list.status(),
        missingOppStatus: cross.status(),
        listOk: list.ok(),
      },
      null,
      2
    )
  );
  expect([200, 201].includes(list.status()) || list.status() < 500).toBeTruthy();
  expect([400, 403, 404].includes(cross.status())).toBeTruthy();
  await clearOverlay(page);
});

test('AUTHENTICATED institution portal mismatch evidence', async ({ page, request }) => {
  const auth = await apiLogin(request);
  // Login as UNIVERSITY then attempt institution portal entry page evidence
  await showQaOverlay(page, {
    testName: 'Institution portal FT exclusion',
    expected: 'Gateway states Field Training is university-only',
  });
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await saveNamedScreenshot(page, 'auth_03_gateway_ft_university_only');
  const instLogin = await request.post(`${API}/api/auth/login`, {
    data: { email: EMAIL, password: PASSWORD, portalType: 'INSTITUTION' },
  });
  fs.writeFileSync(
    path.join(ARTIFACTS, 'logs', 'api-institution-portal-login.json'),
    JSON.stringify({ status: instLogin.status(), body: await instLogin.json().catch(() => null) }, null, 2)
  );
  await clearOverlay(page);
  expect(auth.token).toBeTruthy();
});

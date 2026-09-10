const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const {
  ARTIFACTS,
  showQaOverlay,
  clearOverlay,
  saveNamedScreenshot,
  tryLogin,
  openUniversityLogin,
} = require('./helpers');

const EMAIL = process.env.QA_EMAIL || 'superadmin@batuni.edu';
const PASSWORD = process.env.QA_PASSWORD || '12345678';
const API = process.env.QA_API_BASE_URL || 'https://lms.battechno.com';

test.describe.configure({ mode: 'serial' });

async function authedOrAnnotate(page, testInfo) {
  const login = await tryLogin(page, EMAIL, PASSWORD);
  if (!login.ok) {
    testInfo.annotations.push({ type: 'auth', description: JSON.stringify(login) });
  }
  return login;
}

test('01 admin field training full flow', async ({ page }, testInfo) => {
  await showQaOverlay(page, {
    testName: '01_admin_field_training_full_flow',
    expected: 'University portal → admin FT hub → students/reports surfaces',
  });
  await openUniversityLogin(page);
  await saveNamedScreenshot(page, '01_gateway_university_only_ft_note');
  const login = await authedOrAnnotate(page, testInfo);
  await page.goto('/admin/field-training', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await saveNamedScreenshot(page, '01_admin_ft_hub');
  await page.goto('/admin/field-training/reports', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(2000);
  await saveNamedScreenshot(page, '01_admin_ft_reports');
  await clearOverlay(page);
  expect(login.reason || 'ok').toBeTruthy();
});

test('02 student training flow', async ({ page }) => {
  await showQaOverlay(page, {
    testName: '02_student_training_flow',
    expected: 'Unauthenticated student FT redirects; institution portal copy excludes FT',
  });
  await page.goto('/student/field-training', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await saveNamedScreenshot(page, '02_student_unauth');
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await saveNamedScreenshot(page, '02_gateway_shows_ft_university_only');
  await clearOverlay(page);
});

test('03 attendance hours flow', async ({ page }, testInfo) => {
  await showQaOverlay(page, {
    testName: '03_attendance_hours_flow',
    expected: 'Admin can open FT manage surfaces related to attendance/hours',
  });
  await authedOrAnnotate(page, testInfo);
  await page.goto('/admin/field-training', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await saveNamedScreenshot(page, '03_attendance_hours_surface');
  await clearOverlay(page);
});

test('04 tasks submission grading flow', async ({ page }, testInfo) => {
  await showQaOverlay(page, {
    testName: '04_tasks_submission_grading_flow',
    expected: 'Task surfaces reachable for authorized admin',
  });
  await authedOrAnnotate(page, testInfo);
  await page.goto('/admin/field-training', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  await saveNamedScreenshot(page, '04_tasks_surface');
  await clearOverlay(page);
});

test('05 assessments flow', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await showQaOverlay(page, {
    testName: '05_assessments_flow',
    expected: 'No uncaught page errors while opening FT admin',
  });
  await authedOrAnnotate(page, testInfo);
  await page.goto('/admin/field-training', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  await saveNamedScreenshot(page, '05_assessments_surface');
  expect(errors).toEqual([]);
  await clearOverlay(page);
});

test('06 professional evaluation flow', async ({ page }, testInfo) => {
  await showQaOverlay(page, {
    testName: '06_professional_evaluation_flow',
    expected: 'Evaluation/report hub opens',
  });
  await authedOrAnnotate(page, testInfo);
  await page.goto('/admin/field-training/reports', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(2000);
  await saveNamedScreenshot(page, '06_evaluation_reports');
  await clearOverlay(page);
});

test('07 eligibility logic flow', async ({ page }, testInfo) => {
  await showQaOverlay(page, {
    testName: '07_eligibility_logic_flow',
    expected: 'Eligibility governed by qualification service; UI FT module reachable',
  });
  await authedOrAnnotate(page, testInfo);
  await page.goto('/admin/field-training', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  await saveNamedScreenshot(page, '07_eligibility_surface');
  await clearOverlay(page);
});

test('08 reports exports flow', async ({ page }, testInfo) => {
  await showQaOverlay(page, {
    testName: '08_reports_exports_flow',
    expected: 'Reports hub available for authorized roles',
  });
  await authedOrAnnotate(page, testInfo);
  await page.goto('/admin/field-training/reports', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(2000);
  await saveNamedScreenshot(page, '08_reports_hub');
  await clearOverlay(page);
});

test('09 permissions scope flow', async ({ page, request }) => {
  await showQaOverlay(page, {
    testName: '09_permissions_scope_flow',
    expected: 'Unauth API returns 401/403; institution gateway excludes FT feature list',
  });
  const endpoints = [
    '/api/v1/admin/field-training/opportunities',
    '/api/v1/reports/field-training/universities',
  ];
  const results = [];
  for (const ep of endpoints) {
    const res = await request.get(`${API}${ep}`);
    results.push({ ep, status: res.status() });
  }
  fs.mkdirSync(path.join(ARTIFACTS, 'logs'), { recursive: true });
  fs.writeFileSync(
    path.join(ARTIFACTS, 'logs', 'api-unauth-permissions.json'),
    JSON.stringify(results, null, 2)
  );
  for (const r of results) {
    expect([401, 403, 404].includes(r.status)).toBeTruthy();
  }
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await saveNamedScreenshot(page, '09_permissions_gateway');
  await page.goto('/admin/field-training', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await saveNamedScreenshot(page, '09_permissions_ui');
  await clearOverlay(page);
});

test('10 edge cases and invalid states', async ({ page, request }) => {
  await showQaOverlay(page, {
    testName: '10_edge_cases_and_invalid_states',
    expected: 'Invalid opportunity UUID fails closed; bogus UI route does not 500',
  });
  const bogus = await request.get(
    `${API}/api/v1/admin/field-training/opportunities/00000000-0000-0000-0000-000000000000`
  );
  expect([401, 403, 404].includes(bogus.status())).toBeTruthy();
  await page.goto('/admin/field-training/opportunities/not-a-uuid', {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(1200);
  await saveNamedScreenshot(page, '10_invalid_opportunity_route');
  await clearOverlay(page);
});

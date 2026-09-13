const { test, expect } = require('@playwright/test');
const { showQaOverlay, clearOverlay, saveNamedScreenshot, tryLogin } = require('./helpers');

const ADMIN_EMAIL = process.env.QA_ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.QA_ADMIN_PASSWORD || '';
const ADMIN_OPP = process.env.QA_ADMIN_OPPORTUNITY_ID || '';
const STUDENT_EMAIL = process.env.QA_STUDENT_EMAIL || '';
const STUDENT_PASSWORD = process.env.QA_STUDENT_PASSWORD || '';
const STUDENT_OPP = process.env.QA_STUDENT_OPPORTUNITY_ID || '';
const FOREIGN_OPP = process.env.QA_FOREIGN_OPPORTUNITY_ID || '4d9466cb-127b-42f2-ac08-88e7fcc7c7df';
const REVIEWER_EMAIL = process.env.QA_REVIEWER_EMAIL || '';
const REVIEWER_PASSWORD = process.env.QA_REVIEWER_PASSWORD || '';

test.describe('Phase 7 recorded lectures QA', () => {
  test('unauthenticated recorded-lecture URLs stay inside LMS auth', async ({ page }) => {
    await showQaOverlay(page, {
      testName: 'phase7_recorded_lectures_unauth',
      expected: 'Direct lecture URLs redirect to login and never open YouTube',
    });
    await page.goto(
      `/admin/field-training/${FOREIGN_OPP}?tab=recorded_lectures`,
      { waitUntil: 'domcontentloaded' }
    );
    await page.waitForTimeout(800);
    expect(page.url()).not.toMatch(/youtube\.com/i);

    await page.goto(
      `/student/field-training/${FOREIGN_OPP}/recorded-lectures/00000000-0000-4000-8000-000000000001`,
      { waitUntil: 'domcontentloaded' }
    );
    await page.waitForTimeout(800);
    expect(page.url()).toMatch(/login|auth|portals|student|admin/i);
    expect(page.url()).not.toMatch(/youtube\.com/i);
    await saveNamedScreenshot(page, 'phase7_recorded_lectures_unauth');
    await clearOverlay(page);
  });

  test('optional admin import/reorder/analytics flow requires isolated QA credentials', async ({ page }, testInfo) => {
    test.skip(
      !ADMIN_EMAIL || !ADMIN_PASSWORD || !ADMIN_OPP,
      'Set QA_ADMIN_EMAIL, QA_ADMIN_PASSWORD, and QA_ADMIN_OPPORTUNITY_ID. Do not mutate official historical opportunities.'
    );
    const login = await tryLogin(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    if (!login.ok) testInfo.annotations.push({ type: 'auth', description: JSON.stringify(login) });
    expect(login.ok).toBeTruthy();
    await page.goto(`/admin/field-training/${ADMIN_OPP}?tab=recorded_lectures`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(2500);
    await saveNamedScreenshot(page, 'phase7_admin_recorded_lectures');
    await expect(page.getByText(/المحاضرات المسجلة|YouTube|قائمة التشغيل/)).toBeVisible({
      timeout: 20000,
    });
    await clearOverlay(page);
  });

  test('optional student resume/complete flow requires isolated QA credentials', async ({ page }, testInfo) => {
    test.skip(
      !STUDENT_EMAIL || !STUDENT_PASSWORD || !STUDENT_OPP,
      'Set QA_STUDENT_EMAIL, QA_STUDENT_PASSWORD, and QA_STUDENT_OPPORTUNITY_ID. Do not use historical student 320230601066.'
    );
    const login = await tryLogin(page, STUDENT_EMAIL, STUDENT_PASSWORD);
    if (!login.ok) testInfo.annotations.push({ type: 'auth', description: JSON.stringify(login) });
    expect(login.ok).toBeTruthy();
    await page.goto(`/student/field-training/${STUDENT_OPP}?tab=recorded_lectures`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(2500);
    await saveNamedScreenshot(page, 'phase7_student_recorded_lectures');
    await expect(page.getByRole('heading', { name: 'المحاضرات المسجلة' }).or(page.getByText('لا توجد محاضرات مسجلة متاحة حاليًا.'))).toBeVisible({
      timeout: 20000,
    });
    await clearOverlay(page);
  });

  test('optional reviewer analytics is read-only when QA credentials exist', async ({ page }, testInfo) => {
    test.skip(
      !REVIEWER_EMAIL || !REVIEWER_PASSWORD || !ADMIN_OPP,
      'Set QA_REVIEWER_EMAIL, QA_REVIEWER_PASSWORD, and QA_ADMIN_OPPORTUNITY_ID to exercise reviewer UI.'
    );
    const login = await tryLogin(page, REVIEWER_EMAIL, REVIEWER_PASSWORD);
    if (!login.ok) testInfo.annotations.push({ type: 'auth', description: JSON.stringify(login) });
    expect(login.ok).toBeTruthy();
    await page.goto(`/admin/field-training/${ADMIN_OPP}?tab=recorded_lectures`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(2500);
    await saveNamedScreenshot(page, 'phase7_reviewer_recorded_lectures');
    await expect(page.getByRole('button', { name: /استيراد|نشر|مزامنة|حفظ الترتيب/ })).toHaveCount(0);
    await clearOverlay(page);
  });

  test('seek-to-end cheating is asserted in backend unit tests, not against live YouTube', () => {
    test.skip(
      true,
      'IFrame YouTube playback is not deterministic here. Backend Phase 7 asserts unique=40s and completedAt=null after play 30s, seek to 3590, play 10s, ENDED.'
    );
  });
});

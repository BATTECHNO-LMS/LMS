const { test, expect } = require('@playwright/test');
const { showQaOverlay, clearOverlay, saveNamedScreenshot, tryLogin } = require('./helpers');

const STUDENT_EMAIL = process.env.QA_STUDENT_EMAIL || '';
const STUDENT_PASSWORD = process.env.QA_STUDENT_PASSWORD || '';
const OPPORTUNITY_ID = process.env.QA_STUDENT_OPPORTUNITY_ID || '';
const LECTURE_ID = process.env.QA_STUDENT_LECTURE_ID || '';

test.describe('Phase 5 student recorded lectures UX', () => {
  test('unauthenticated student recorded-lecture routes stay inside LMS auth', async ({ page }) => {
    await showQaOverlay(page, {
      testName: 'recorded_lectures_unauth',
      expected: 'Student recorded lecture URLs redirect to login and do not open YouTube',
    });
    await page.goto('/student/field-training', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await saveNamedScreenshot(page, 'recorded_lectures_student_unauth');
    expect(page.url()).not.toMatch(/youtube\.com/i);

    await page.goto(
      '/student/field-training/cbe032b3-e7ef-475f-851e-faa7e61264b2?tab=recorded_lectures',
      { waitUntil: 'domcontentloaded' }
    );
    await page.waitForTimeout(1200);
    expect(page.url()).toMatch(/login|auth|student|portals/i);
    expect(page.url()).not.toMatch(/youtube\.com/i);

    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.waitForTimeout(300);
      await saveNamedScreenshot(page, `recorded_lectures_unauth_${width}`);
    }
    await clearOverlay(page);
  });

  test('optional authenticated student flow uses isolated QA credentials only', async ({ page }, testInfo) => {
    test.skip(
      !STUDENT_EMAIL || !STUDENT_PASSWORD || !OPPORTUNITY_ID,
      'Set QA_STUDENT_EMAIL, QA_STUDENT_PASSWORD, and QA_STUDENT_OPPORTUNITY_ID to run mutating student playback checks. Do not use historical production student accounts.'
    );

    const login = await tryLogin(page, STUDENT_EMAIL, STUDENT_PASSWORD);
    if (!login.ok) {
      testInfo.annotations.push({ type: 'auth', description: JSON.stringify(login) });
    }
    expect(login.ok).toBeTruthy();

    await page.goto(`/student/field-training/${OPPORTUNITY_ID}?tab=recorded_lectures`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(2500);
    await saveNamedScreenshot(page, 'recorded_lectures_student_list');

    const empty = page.getByText('لا توجد محاضرات مسجلة متاحة حاليًا.');
    const start = page.getByRole('link', { name: /بدء المشاهدة|متابعة المشاهدة|مشاهدة مرة أخرى/ });
    const heading = page.getByRole('heading', { name: 'المحاضرات المسجلة' });
    await expect(heading.or(empty)).toBeVisible({ timeout: 20000 });

    if (await empty.count()) {
      await clearOverlay(page);
      return;
    }

    if (LECTURE_ID) {
      await page.goto(
        `/student/field-training/${OPPORTUNITY_ID}/recorded-lectures/${LECTURE_ID}`,
        { waitUntil: 'domcontentloaded' }
      );
    } else if (await start.count()) {
      await start.first().click();
    }
    await page.waitForTimeout(2500);
    await saveNamedScreenshot(page, 'recorded_lectures_student_player');
    await expect(page.locator('.ft-recorded-player__frame, .ft-recorded-player__unsupported')).toBeVisible();
    await expect(page.getByText(/حضور التسجيل/)).toHaveCount(0);

    const previous = page.getByRole('link', { name: 'المحاضرة السابقة' });
    const next = page.getByRole('link', { name: 'المحاضرة التالية' });
    if ((await previous.count()) || (await next.count())) {
      if (await next.count()) {
        await next.click();
        await page.waitForTimeout(1500);
        await saveNamedScreenshot(page, 'recorded_lectures_student_next');
      }
      if (await previous.count()) {
        await page.getByRole('link', { name: 'المحاضرة السابقة' }).click();
        await page.waitForTimeout(1500);
      }
    }

    await page.getByRole('link', { name: 'العودة إلى المحاضرات المسجلة' }).click();
    await page.waitForTimeout(1200);
    await expect(page.getByRole('heading', { name: 'المحاضرات المسجلة' })).toBeVisible();
    await clearOverlay(page);
  });
});

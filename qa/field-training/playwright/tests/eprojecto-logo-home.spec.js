const { test, expect } = require('@playwright/test');

test.describe('eprojecto brand logo home navigation', () => {
  test('login logo is a client-side link to /', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    const logo = page.getByRole('link', {
      name: /العودة إلى الصفحة الرئيسية|Back to home page/i,
    }).first();
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute('href', '/');
    await logo.click();
    await expect(page).toHaveURL(/\/(?:\?.*)?$/);
  });

  test('public home header logo stays on /', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const logo = page.getByRole('link', {
      name: /العودة إلى الصفحة الرئيسية|Back to home page/i,
    }).first();
    await expect(logo).toBeVisible();
    await logo.click();
    await expect(page).toHaveURL(/\/(?:\?.*)?$/);
  });
});

const { expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ARTIFACTS = path.join(__dirname, '../../../../qa-artifacts/field-training');

async function showQaOverlay(page, { testName, expected }) {
  await page.evaluate(
    ({ testName: name, expected: exp }) => {
      let el = document.getElementById('qa-overlay-banner');
      if (!el) {
        el = document.createElement('div');
        el.id = 'qa-overlay-banner';
        el.style.cssText =
          'position:fixed;z-index:2147483647;left:12px;right:12px;top:12px;padding:14px 16px;background:rgba(10,25,50,.92);color:#fff;font:14px/1.45 Segoe UI,Tahoma,sans-serif;border:2px solid #d4af37;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.35);direction:ltr;text-align:left;';
        document.body.appendChild(el);
      }
      el.innerHTML = `<div style="font-weight:700;margin-bottom:6px">QA Test: ${name}</div><div>Expected: ${exp}</div>`;
    },
    { testName, expected }
  );
  await page.waitForTimeout(800);
}

async function clearOverlay(page) {
  await page.evaluate(() => {
    const el = document.getElementById('qa-overlay-banner');
    if (el) el.remove();
  });
}

async function saveNamedScreenshot(page, name) {
  const dir = path.join(ARTIFACTS, 'screenshots');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function openUniversityLogin(page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  // Portal gateway
  const uniBtn = page.getByRole('link', { name: /بوابة الجامعات|Universit/i }).first();
  if (await uniBtn.count()) {
    await uniBtn.click();
    await page.waitForTimeout(800);
  } else {
    // Direct university admin login path used by product
    await page.goto('/login/admin', { waitUntil: 'domcontentloaded' });
  }
}

async function tryLogin(page, email, password) {
  await openUniversityLogin(page);
  await showQaOverlay(page, {
    testName: 'Authentication',
    expected: 'University portal login succeeds for QA account',
  });
  await saveNamedScreenshot(page, 'login_university_portal');

  const emailInput = page.locator('input[type="email"], input[name="email"], input[name="username"]').first();
  const passInput = page.locator('input[type="password"]').first();
  if (!(await emailInput.count()) || !(await passInput.count())) {
    // Try universities login path
    await page.goto('/universities/login', { waitUntil: 'domcontentloaded' });
  }
  const email2 = page.locator('input[type="email"], input[name="email"], input[name="username"]').first();
  const pass2 = page.locator('input[type="password"]').first();
  if (!(await email2.count()) || !(await pass2.count())) {
    await saveNamedScreenshot(page, 'login_form_missing');
    return { ok: false, reason: 'login_form_not_found', url: page.url() };
  }
  await email2.fill(email);
  await pass2.fill(password);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(3000);
  const url = page.url();
  const stillLogin = /login|auth/i.test(url);
  await saveNamedScreenshot(page, stillLogin ? 'login_failed' : 'login_success');
  await clearOverlay(page);
  return { ok: !stillLogin, url, reason: stillLogin ? 'still_on_login' : 'navigated' };
}

module.exports = {
  ARTIFACTS,
  showQaOverlay,
  clearOverlay,
  saveNamedScreenshot,
  tryLogin,
  openUniversityLogin,
  expect,
};

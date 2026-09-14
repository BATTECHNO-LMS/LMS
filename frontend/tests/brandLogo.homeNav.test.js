import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

describe('eprojecto BrandLogo home navigation', () => {
  test('BrandLogo uses React Router Link to / with accessible name', () => {
    const src = read('src/components/common/BrandLogo.jsx');
    assert.match(src, /from 'react-router-dom'/);
    assert.match(src, /export const BRAND_HOME_PATH = '\/'/);
    assert.match(src, /<Link/);
    assert.match(src, /to=\{BRAND_HOME_PATH\}/);
    assert.match(src, /aria-label=\{homeLabel\}/);
    assert.match(src, /eprojecto-logo\.png/);
    assert.match(src, /BRAND_LOGO_WIDTH/);
    assert.doesNotMatch(src, /<a\s+href="\/"/);
    assert.doesNotMatch(src, /battechno-lms-logo/);
  });

  test('logo styles preserve aspect ratio and do not invert the mark', () => {
    const scss = read('src/assets/styles/components/_brand-logo.scss');
    assert.match(scss, /object-fit:\s*contain/);
    assert.match(scss, /\.brand-logo-link/);
    assert.match(scss, /cursor:\s*pointer/);
    assert.match(scss, /:focus-visible/);
    const illustrated = read('src/assets/styles/components/_design-system.scss');
    assert.doesNotMatch(illustrated, /illustrated-status__logo[\s\S]{0,200}filter:\s*brightness\(0\)\s*invert\(1\)/);
  });

  test('shell layouts reuse BrandLogo without a nested home Link', () => {
    const files = [
      'src/components/common/AppNavbar.jsx',
      'src/components/navigation/AdminSidebar.jsx',
      'src/pages/auth/LoginPage.jsx',
      'src/features/auth/pages/RegisterPage.jsx',
      'src/pages/auth/ForgotPasswordPage.jsx',
      'src/pages/auth/NewPasswordPage.jsx',
      'src/pages/auth/VerifyEmailOtpPage.jsx',
      'src/pages/auth/VerifyPasswordResetOtpPage.jsx',
      'src/components/landing/hero/HeroFloatingNav.jsx',
      'src/components/landing/HomeFooter.jsx',
      'src/pages/public/LegalPublicPages.jsx',
    ];
    for (const file of files) {
      const src = read(file);
      assert.match(src, /BrandLogo/, `${file} should render BrandLogo`);
      assert.doesNotMatch(
        src,
        /<Link to="\/"[^>]*>\s*<BrandLogo/,
        `${file} must not nest Link around BrandLogo`
      );
      assert.doesNotMatch(src, /battechno-lms-logo/, `${file} must not use the old LMS mark`);
    }

    const dashboard = read('src/layouts/BaseDashboardLayout.jsx');
    assert.match(dashboard, /AppNavbar/);
    assert.match(dashboard, /AdminSidebar/);
    assert.doesNotMatch(dashboard, /battechno-lms-logo/);
  });

  test('i18n exposes home aria-label', () => {
    const ar = JSON.parse(read('src/i18n/locales/ar/common.json'));
    const en = JSON.parse(read('src/i18n/locales/en/common.json'));
    assert.equal(ar.logo.alt, 'eprojecto');
    assert.equal(en.logo.alt, 'eprojecto');
    assert.equal(ar.logo.homeAria, 'العودة إلى الصفحة الرئيسية');
    assert.equal(en.logo.homeAria, 'Back to home page');
  });
});

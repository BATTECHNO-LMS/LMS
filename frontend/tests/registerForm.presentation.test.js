import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

describe('RegisterForm registration UX + payload', () => {
  test('submits tenant UUID fields only (not directory/faculty/major codes)', () => {
    const src = read('src/features/auth/components/RegisterForm.jsx');
    assert.match(src, /university_id:\s*data\.university/);
    assert.match(src, /university_specialty_id:\s*data\.specialty/);
    assert.doesNotMatch(src, /facultyCode|majorCode|universityDirectoryCode|trackCode/);
  });

  test('email, phone, and password inputs use dir=ltr inside RTL page', () => {
    const src = read('src/features/auth/components/RegisterForm.jsx');
    assert.match(src, /id="register-email"[\s\S]*?dir="ltr"/);
    assert.match(src, /id="register-phone"[\s\S]*?dir="ltr"/);
    assert.match(src, /id="register-password"[\s\S]*?dir="ltr"/);
    assert.match(src, /id="register-confirm-password"[\s\S]*?dir="ltr"/);
  });

  test('maps known registration error codes to Arabic messages', () => {
    const src = read('src/features/auth/components/RegisterForm.jsx');
    for (const code of [
      'EMAIL_ALREADY_EXISTS',
      'EMAIL_DOMAIN_MISMATCH',
      'UNIVERSITY_NOT_FOUND',
      'UNIVERSITY_SPECIALTY_MISMATCH',
      'PASSWORD_TOO_WEAK',
    ]) {
      assert.match(src, new RegExp(code));
    }
    assert.match(src, /requestId/);
  });

  test('treats emailDeliveryFailed as successful registration with resend path', () => {
    const src = read('src/features/auth/components/RegisterForm.jsx');
    assert.match(src, /emailDeliveryFailed/);
    assert.match(src, /تم إنشاء الحساب، لكن تعذر إرسال رمز التحقق/);
    const authService = read('src/features/auth/auth.service.js');
    assert.match(authService, /emailDeliveryFailed:\s*Boolean\(payload\.emailDeliveryFailed\)/);
  });

  test('disables submit while loading (double-submit guard)', () => {
    const src = read('src/features/auth/components/RegisterForm.jsx');
    assert.match(src, /isSubmitting/);
    assert.match(src, /loading=\{isSubmitting\}/);
  });

  test('client password min length matches backend (8)', () => {
    const schema = read('src/features/auth/validation/registerStudentSchema.js');
    assert.match(schema, /password:\s*z\.string\(\)\.min\(8/);
    assert.doesNotMatch(schema, /password:\s*z\.string\(\)\.min\(6/);
  });
});

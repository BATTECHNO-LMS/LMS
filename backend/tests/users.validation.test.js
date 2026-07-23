const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  createUserBodySchema,
  updateUserBodySchema,
} = require('../src/modules/users/users.validation');

describe('users validation create', () => {
  test('accepts student with university specialty and independent verification', () => {
    const parsed = createUserBodySchema.safeParse({
      full_name: 'طالب تجريبي',
      email: 'student@mutah.edu.jo',
      password: 'secret12',
      status: 'inactive',
      email_verified: true,
      primary_university_id: '11111111-1111-1111-1111-111111111111',
      university_specialty_id: '22222222-2222-2222-2222-222222222222',
      role_codes: ['student'],
    });
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.email_verified, true);
    assert.equal(parsed.data.status, 'inactive');
    assert.equal(parsed.data.email, 'student@mutah.edu.jo');
  });

  test('accepts instructor with university only', () => {
    const parsed = createUserBodySchema.safeParse({
      full_name: 'مدرس',
      email: 'teacher@mutah.edu.jo',
      password: 'secret12',
      primary_university_id: '11111111-1111-1111-1111-111111111111',
      role_codes: ['instructor'],
      status: 'active',
      email_verified: false,
    });
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.email_verified, false);
  });
});

describe('users validation update', () => {
  test('allows email_verified without coupling status', () => {
    const parsed = updateUserBodySchema.safeParse({
      email_verified: true,
      status: 'inactive',
    });
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.email_verified, true);
    assert.equal(parsed.data.status, 'inactive');
  });
});

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { registerSchema } = require('../src/modules/auth/auth.validation');

describe('registerSchema payload shape', () => {
  const valid = {
    full_name: "HA'A ALDEEN ABU-FARASH",
    email: '21220019@htu.edu.jo',
    password: 'SecurePass1!',
    university_id: '76227613-e189-4e86-8659-8dce511baa63',
    university_specialty_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    phone: '+962788658736',
  };

  it('accepts the current frontend payload field names', () => {
    const parsed = registerSchema.parse(valid);
    assert.equal(parsed.email, '21220019@htu.edu.jo');
    assert.equal(parsed.university_id, valid.university_id);
    assert.equal(parsed.university_specialty_id, valid.university_specialty_id);
    assert.equal(parsed.phone, '+962788658736');
    assert.equal(parsed.password, valid.password);
  });

  it('rejects directory university codes as university_id (must be UUID)', () => {
    const result = registerSchema.safeParse({ ...valid, university_id: 'HTU' });
    assert.equal(result.success, false);
  });

  it('rejects major codes as university_specialty_id (must be UUID)', () => {
    const result = registerSchema.safeParse({ ...valid, university_specialty_id: 'CYBERSECURITY' });
    assert.equal(result.success, false);
  });

  it('rejects invalid email with controlled schema failure (not opaque 500)', () => {
    const result = registerSchema.safeParse({ ...valid, email: 'not-an-email' });
    assert.equal(result.success, false);
  });

  it('allows omitted optional phone', () => {
    const { phone, ...withoutPhone } = valid;
    const parsed = registerSchema.parse(withoutPhone);
    assert.equal(parsed.phone, undefined);
  });

  it('rejects unknown keys (mass-assignment / role escalation blocked)', () => {
    const result = registerSchema.safeParse({ ...valid, role: 'admin', isGlobal: true });
    assert.equal(result.success, false);
  });
});

/**
 * Phase 1 program_admin freeze — assignable UI + legacy display labels.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ASSIGNABLE_USER_ROLE_CODES, ROLES } from '../src/constants/roles.js';
import { userSchema, userUpdateSchema } from '../src/schemas/adminCrudSchemas.js';
import { roleLabelAr } from '../src/utils/labelsAr.js';

const SAMPLE_UNIVERSITY_ID = '00000000-0000-4000-8000-000000000001';

describe('program_admin frontend freeze (Phase 1)', () => {
  it('program_admin is absent from assignable role options', () => {
    assert.ok(!ASSIGNABLE_USER_ROLE_CODES.includes('program_admin'));
    assert.deepEqual(ASSIGNABLE_USER_ROLE_CODES, [
      ROLES.STUDENT,
      ROLES.INSTRUCTOR,
      ROLES.ADMIN,
      ROLES.REVIEWER,
    ]);
  });

  it('create schema rejects program_admin', () => {
    const res = userSchema.safeParse({
      full_name: 'A',
      email: 'a@example.com',
      password: 'secret1',
      confirm_password: 'secret1',
      role: 'program_admin',
      status: 'active',
      primary_university_id: SAMPLE_UNIVERSITY_ID,
    });
    assert.equal(res.success, false);
  });

  it('create schema accepts assignable roles', () => {
    const res = userSchema.safeParse({
      full_name: 'A',
      email: 'a@example.com',
      password: 'secret1',
      confirm_password: 'secret1',
      role: 'instructor',
      status: 'active',
      primary_university_id: SAMPLE_UNIVERSITY_ID,
    });
    assert.equal(res.success, true);
  });

  it('update schema rejects program_admin (fail-closed, not assignable)', () => {
    const res = userUpdateSchema.safeParse({
      full_name: 'Legacy',
      role: 'program_admin',
      status: 'active',
    });
    assert.equal(res.success, false);
  });

  it('existing program_admin values render with deprecated legacy label', () => {
    assert.equal(roleLabelAr('program_admin', 'en'), 'Program Admin — Deprecated');
    assert.equal(roleLabelAr('program_admin', 'ar'), 'إداري برامج — متوقف');
  });
});

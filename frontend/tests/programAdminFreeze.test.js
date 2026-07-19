/**
 * Phase 1 program_admin freeze — assignable UI + legacy display labels.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ASSIGNABLE_USER_ROLE_CODES, ROLES } from '../src/constants/roles.js';
import { userSchema, userUpdateSchema } from '../src/schemas/adminCrudSchemas.js';
import { roleLabelAr } from '../src/utils/labelsAr.js';

describe('program_admin frontend freeze (Phase 1)', () => {
  it('program_admin is absent from assignable role options', () => {
    assert.ok(!ASSIGNABLE_USER_ROLE_CODES.includes(ROLES.PROGRAM_ADMIN));
    assert.deepEqual(ASSIGNABLE_USER_ROLE_CODES, [
      ROLES.INSTRUCTOR,
      ROLES.STUDENT,
      ROLES.QA_OFFICER,
      ROLES.ACADEMIC_ADMIN,
    ]);
  });

  it('create schema rejects program_admin', () => {
    const res = userSchema.safeParse({
      name: 'A',
      email: 'a@example.com',
      password: 'secret1',
      role: 'program_admin',
      status: 'active',
    });
    assert.equal(res.success, false);
  });

  it('create schema accepts assignable roles', () => {
    const res = userSchema.safeParse({
      name: 'A',
      email: 'a@example.com',
      password: 'secret1',
      role: 'instructor',
      status: 'active',
    });
    assert.equal(res.success, true);
  });

  it('update schema may hold legacy program_admin for display/edit state', () => {
    const res = userUpdateSchema.safeParse({
      name: 'Legacy',
      role: 'program_admin',
      status: 'active',
    });
    assert.equal(res.success, true);
  });

  it('existing program_admin values render with deprecated legacy label', () => {
    assert.equal(roleLabelAr('program_admin', 'en'), 'Program Admin — Deprecated');
    assert.equal(roleLabelAr('program_admin', 'ar'), 'إداري برامج — متوقف');
  });
});

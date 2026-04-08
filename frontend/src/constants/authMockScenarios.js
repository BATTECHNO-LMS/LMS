import { ROLES } from './roles.js';
import { TENANT_SCOPE_ALL, TENANTS } from './tenants.js';

/**
 * @typedef {{
 *   key: string,
 *   labelAr: string,
 *   labelEn: string,
 *   role: string,
 *   isGlobal: boolean,
 *   tenantId: string | null
 * }} AuthMockScenario
 */

/** @type {AuthMockScenario[]} */
export const AUTH_MOCK_SCENARIOS = [
  {
    key: 'super_admin',
    labelAr: 'مسؤول النظام (عالمي — جميع الجامعات)',
    labelEn: 'Super Admin (global — all universities)',
    role: ROLES.SUPER_ADMIN,
    isGlobal: true,
    tenantId: TENANT_SCOPE_ALL,
  },
  {
    key: 'program_admin_psut',
    labelAr: 'مسؤول برامج — جامعة الأميرة سمية',
    labelEn: 'Program Admin — Princess Sumaya University',
    role: ROLES.PROGRAM_ADMIN,
    isGlobal: false,
    tenantId: TENANTS.find((t) => t.id === 'uni-3')?.id ?? 'uni-3',
  },
  {
    key: 'instructor_yu',
    labelAr: 'مدرّس — جامعة اليرموك',
    labelEn: 'Instructor — Yarmouk University',
    role: ROLES.INSTRUCTOR,
    isGlobal: false,
    tenantId: 'uni-1',
  },
  {
    key: 'student_yu',
    labelAr: 'طالب — جامعة اليرموك',
    labelEn: 'Student — Yarmouk University',
    role: ROLES.STUDENT,
    isGlobal: false,
    tenantId: 'uni-1',
  },
  {
    key: 'reviewer_uj',
    labelAr: 'مراجع جامعي — الجامعة الأردنية',
    labelEn: 'University reviewer — University of Jordan',
    role: ROLES.UNIVERSITY_REVIEWER,
    isGlobal: false,
    tenantId: 'uni-2',
  },
];

export const AUTH_MOCK_SCENARIO_ORDER = AUTH_MOCK_SCENARIOS;

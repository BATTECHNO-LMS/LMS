'use strict';

/**
 * Canonical permission catalog (modules × actions).
 * Codes: `{module}.{action}` e.g. users.view, field_training.approve
 */

const ACTIONS = Object.freeze(['view', 'create', 'update', 'delete', 'approve', 'export', 'manage']);

const WRITE_ACTIONS = Object.freeze(['create', 'update', 'delete', 'approve', 'manage']);

const MODULES = Object.freeze([
  { key: 'users', name: 'Users', name_ar: 'المستخدمون' },
  { key: 'universities', name: 'Universities & specialties', name_ar: 'الجامعات والتخصصات' },
  { key: 'courses', name: 'Courses & lessons', name_ar: 'الكورسات والدروس' },
  { key: 'field_training', name: 'Field training', name_ar: 'التدريب الميداني' },
  { key: 'sessions', name: 'Sessions & attendance', name_ar: 'الجلسات والحضور' },
  { key: 'tasks', name: 'Tasks & submissions', name_ar: 'المهام والتسليمات' },
  { key: 'assessments', name: 'Assessments & grades', name_ar: 'التقييمات والدرجات' },
  { key: 'reports', name: 'Reports & export', name_ar: 'التقارير والتصدير' },
  { key: 'certificates', name: 'Certificates & completion letters', name_ar: 'الشهادات وكتب الإنهاء' },
  { key: 'notifications', name: 'Notifications', name_ar: 'الإشعارات' },
  { key: 'settings', name: 'Settings', name_ar: 'الإعدادات' },
]);

function permCode(moduleKey, action) {
  return `${moduleKey}.${action}`;
}

function buildPermissionDefinitions() {
  const defs = [];
  for (const mod of MODULES) {
    for (const action of ACTIONS) {
      defs.push({
        code: permCode(mod.key, action),
        module: mod.key,
        name: `${mod.name} — ${action}`,
        description: `${action} access for ${mod.key}`,
      });
    }
  }
  return defs;
}

const ALL_PERMISSION_CODES = Object.freeze(buildPermissionDefinitions().map((d) => d.code));

/** Super Admin always keeps these; UI cannot strip them. */
const SUPER_ADMIN_LOCKED_CODES = Object.freeze([...ALL_PERMISSION_CODES]);

/** Academic reviewer may only hold view/export (never write). */
const REVIEWER_ALLOWED_ACTIONS = Object.freeze(['view', 'export']);

function isWritePermissionCode(code) {
  const action = String(code || '').split('.').pop();
  return WRITE_ACTIONS.includes(action);
}

function reviewerAllowedCodes() {
  const out = [];
  for (const mod of MODULES) {
    for (const action of REVIEWER_ALLOWED_ACTIONS) {
      out.push(permCode(mod.key, action));
    }
  }
  return out;
}

/**
 * Default matrix after ensure — mirrors product five-role model.
 * @returns {Record<string, string[]>}
 */
function defaultRolePermissionMap() {
  const all = [...ALL_PERMISSION_CODES];
  const adminMods = [
    'users',
    'universities',
    'courses',
    'field_training',
    'sessions',
    'tasks',
    'assessments',
    'reports',
    'certificates',
    'notifications',
  ];
  const adminCodes = [];
  for (const mod of adminMods) {
    for (const action of ACTIONS) {
      if (mod === 'settings' && action !== 'view') continue;
      adminCodes.push(permCode(mod, action));
    }
  }

  const instructorCodes = [
    'courses.view',
    'courses.update',
    'field_training.view',
    'field_training.update',
    'sessions.view',
    'sessions.create',
    'sessions.update',
    'sessions.manage',
    'tasks.view',
    'tasks.create',
    'tasks.update',
    'tasks.manage',
    'assessments.view',
    'assessments.create',
    'assessments.update',
    'assessments.manage',
    'reports.view',
    'notifications.view',
    'notifications.update',
  ];

  const studentCodes = [
    'courses.view',
    'field_training.view',
    'sessions.view',
    'tasks.view',
    'tasks.create',
    'assessments.view',
    'assessments.create',
    'certificates.view',
    'notifications.view',
    'notifications.update',
    'reports.view',
  ];

  return {
    super_admin: all,
    admin: [...new Set(adminCodes)],
    instructor: instructorCodes,
    student: studentCodes,
    academic_reviewer: reviewerAllowedCodes(),
  };
}

module.exports = {
  ACTIONS,
  WRITE_ACTIONS,
  MODULES,
  permCode,
  buildPermissionDefinitions,
  ALL_PERMISSION_CODES,
  SUPER_ADMIN_LOCKED_CODES,
  REVIEWER_ALLOWED_ACTIONS,
  isWritePermissionCode,
  reviewerAllowedCodes,
  defaultRolePermissionMap,
};

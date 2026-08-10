'use strict';

/**
 * Course-assignment permission policy for institutional trainers.
 * These flags live on training_trainer_assignments (not global admin roles).
 */

const TRAINER_ASSIGNMENT_PERMISSION_FIELDS = Object.freeze([
  'can_manage_sessions',
  'can_manage_attendance',
  'can_manage_materials',
  'can_manage_tasks',
  'can_grade_tasks',
  'can_manage_assessments',
  'can_grade_assessments',
  'can_view_trainees',
  'can_view_progress',
  'can_view_reports',
  'can_finalize_training',
  'can_send_course_announcements',
]);

/** Full operational management for an assigned primary trainer. */
const PRIMARY_TRAINER_FULL_OPS = Object.freeze({
  is_lead_trainer: true,
  can_manage_sessions: true,
  can_manage_attendance: true,
  can_manage_materials: true,
  can_manage_tasks: true,
  can_grade_tasks: true,
  can_manage_assessments: true,
  can_grade_assessments: true,
  can_view_trainees: true,
  can_view_progress: true,
  can_view_reports: true,
  can_finalize_training: true,
  can_send_course_announcements: true,
});

/**
 * Defaults for a normal course assignment (non-lead).
 * Manage/view flags default true; finalize enabled for normal completion workflow.
 * Exceptional finalization remains admin-only in the completion service.
 */
const ASSIGNED_TRAINER_OPS_DEFAULTS = Object.freeze({
  is_lead_trainer: false,
  can_manage_sessions: true,
  can_manage_attendance: true,
  can_manage_materials: true,
  can_manage_tasks: true,
  can_grade_tasks: true,
  can_manage_assessments: true,
  can_grade_assessments: true,
  can_view_trainees: true,
  can_view_progress: true,
  can_view_reports: true,
  can_finalize_training: true,
  can_send_course_announcements: true,
});

/**
 * Resolve permission payload for create/update of a trainer assignment.
 * Explicit body values always win. Lead trainers receive the primary full-ops template
 * as the baseline.
 *
 * @param {{ is_lead_trainer?: boolean } & Record<string, boolean|undefined>} body
 */
function resolveTrainerAssignmentPermissions(body = {}) {
  const isLead = body.is_lead_trainer === true;
  const baseline = isLead ? PRIMARY_TRAINER_FULL_OPS : ASSIGNED_TRAINER_OPS_DEFAULTS;
  const resolved = { ...baseline, is_lead_trainer: isLead };
  for (const key of TRAINER_ASSIGNMENT_PERMISSION_FIELDS) {
    if (body[key] !== undefined) resolved[key] = Boolean(body[key]);
  }
  if (body.is_lead_trainer !== undefined) {
    resolved.is_lead_trainer = Boolean(body.is_lead_trainer);
  }
  return resolved;
}

module.exports = {
  TRAINER_ASSIGNMENT_PERMISSION_FIELDS,
  PRIMARY_TRAINER_FULL_OPS,
  ASSIGNED_TRAINER_OPS_DEFAULTS,
  resolveTrainerAssignmentPermissions,
};

'use strict';

const { z } = require('zod');

const organizationIdParam = z.object({ organizationId: z.string().uuid() });
const programIdParam = z.object({ programId: z.string().uuid() });
const assignmentIdParam = z.object({
  organizationId: z.string().uuid(),
  assignmentId: z.string().uuid(),
});

const createTrainerBody = z
  .object({
    full_name: z.string().trim().min(1).max(255),
    email: z.string().email().max(255),
    phone: z.string().trim().min(1).max(50),
    branch_id: z.string().uuid().optional().nullable(),
    activate: z.boolean().optional(),
    temporary_password: z.string().min(8).max(100).optional(),
    profile: z
      .object({
        professional_bio: z.string().max(5000).optional().nullable(),
        training_field: z.string().max(255).optional().nullable(),
        specialty: z.string().max(255).optional().nullable(),
        cv_url: z.string().max(1000).optional().nullable(),
        avatar_url: z.string().max(1000).optional().nullable(),
      })
      .optional(),
  })
  .strict();

const assignTrainerBody = z
  .object({
    trainer_user_id: z.string().uuid(),
    training_program_id: z.string().uuid(),
    training_cohort_id: z.string().uuid().optional().nullable(),
    is_lead_trainer: z.boolean().optional(),
    can_manage_sessions: z.boolean().optional(),
    can_manage_attendance: z.boolean().optional(),
    can_manage_materials: z.boolean().optional(),
    can_manage_tasks: z.boolean().optional(),
    can_grade_tasks: z.boolean().optional(),
    can_manage_assessments: z.boolean().optional(),
    can_grade_assessments: z.boolean().optional(),
    can_view_trainees: z.boolean().optional(),
    can_view_progress: z.boolean().optional(),
    can_view_reports: z.boolean().optional(),
    can_finalize_training: z.boolean().optional(),
    can_send_course_announcements: z.boolean().optional(),
  })
  .strict();

module.exports = {
  organizationIdParam,
  programIdParam,
  assignmentIdParam,
  createTrainerBody,
  assignTrainerBody,
};

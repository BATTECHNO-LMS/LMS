'use strict';

const { z } = require('zod');

const uuidParamSchema = z.object({ id: z.string().uuid() });
const orgIdParamSchema = z.object({ organizationId: z.string().uuid() });

const createInstitutionBodySchema = z.object({
  name: z.string().trim().min(2).max(255),
  name_en: z.string().trim().max(255).optional().nullable(),
  short_name: z.string().trim().max(80).optional().nullable(),
  code: z.string().trim().max(50).optional().nullable(),
  institution_kind: z
    .enum([
      'government',
      'private',
      'association',
      'organization',
      'training_center',
      'international',
      'other',
    ])
    .optional()
    .nullable(),
  website: z.string().trim().max(500).optional().nullable(),
  country: z.string().trim().max(120).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  contact_email: z.string().trim().email().max(255).optional().nullable(),
  contact_phone: z.string().trim().max(50).optional().nullable(),
  logo_url: z.string().trim().max(1000).optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive', 'archived']).optional(),
  allows_public_trainee_registration: z.boolean().optional(),
});

const updateInstitutionBodySchema = createInstitutionBodySchema.partial();

const branchBodySchema = z.object({
  name: z.string().trim().min(1).max(255),
  name_en: z.string().trim().max(255).optional().nullable(),
  code: z.string().trim().max(80).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  sort_order: z.number().int().min(0).max(10000).optional(),
  is_active: z.boolean().optional(),
});

const updateBranchBodySchema = branchBodySchema.partial().refine(
  (b) => Object.keys(b).length > 0,
  { message: 'No branch fields to update' }
);

const branchIdParamSchema = z.object({
  organizationId: z.string().uuid(),
  branchId: z.string().uuid(),
});

const departmentBodySchema = z.object({
  name: z.string().trim().min(1).max(255),
  name_en: z.string().trim().max(255).optional().nullable(),
  code: z.string().trim().max(80).optional().nullable(),
  branch_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().optional(),
});

const assignmentBodySchema = z.object({
  user_id: z.string().uuid(),
  /** Institution uses trainer/trainee; university uses instructor/student. */
  role_code: z.enum(['admin', 'instructor', 'trainer', 'trainee', 'student', 'reviewer']),
  branch_id: z.string().uuid().optional().nullable(),
  department_id: z.string().uuid().optional().nullable(),
  job_title: z.string().trim().max(255).optional().nullable(),
  employee_number: z.string().trim().max(100).optional().nullable(),
});

const verifyEmailBodySchema = z.object({
  user_id: z.string().uuid(),
  reason: z.string().trim().min(3).max(500),
  method: z.enum(['ADMIN', 'IMPORT']).default('ADMIN'),
});

const activationBodySchema = z.object({
  user_id: z.string().uuid(),
  action: z.enum(['activate', 'reject', 'disable']),
  reason: z.string().trim().max(500).optional().nullable(),
});

const listMembersQuerySchema = z.object({
  status: z.enum(['active', 'inactive', 'suspended', 'rejected']).optional(),
  pending_activation: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .optional()
    .transform((v) => v === true || v === 'true'),
  role_code: z.enum(['admin', 'instructor', 'trainer', 'trainee', 'student', 'reviewer']).optional(),
});

module.exports = {
  uuidParamSchema,
  orgIdParamSchema,
  branchIdParamSchema,
  createInstitutionBodySchema,
  updateInstitutionBodySchema,
  branchBodySchema,
  updateBranchBodySchema,
  departmentBodySchema,
  assignmentBodySchema,
  verifyEmailBodySchema,
  activationBodySchema,
  listMembersQuerySchema,
};

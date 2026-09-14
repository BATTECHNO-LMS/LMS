const { z } = require('zod');

const analyticsQuerySchema = z
  .object({
    university_id: z.string().uuid().optional(),
    track_id: z.string().uuid().optional(),
    micro_credential_id: z.string().uuid().optional(),
    cohort_id: z.string().uuid().optional(),
    from: z.string().max(40).optional(),
    to: z.string().max(40).optional(),
    lang: z.enum(['ar', 'en']).optional(),
  })
  .strict()
  .transform((q) => {
    let fromDate;
    let toDate;
    if (q.from) {
      const d = new Date(q.from);
      if (!Number.isNaN(d.getTime())) fromDate = d;
    }
    if (q.to) {
      const d = new Date(q.to);
      if (!Number.isNaN(d.getTime())) toDate = d;
    }
    return {
      university_id: q.university_id,
      track_id: q.track_id,
      micro_credential_id: q.micro_credential_id,
      cohort_id: q.cohort_id,
      from: fromDate,
      to: toDate,
      lang: q.lang,
    };
  });

const commandCenterQuerySchema = z
  .object({
    period: z.enum(['today', '7d', '30d', 'custom']).optional().default('30d'),
    dateFrom: z.string().max(40).optional(),
    dateTo: z.string().max(40).optional(),
    from: z.string().max(40).optional(),
    to: z.string().max(40).optional(),
    organizationId: z.string().uuid().optional(),
    organization_id: z.string().uuid().optional(),
    universityId: z.string().uuid().optional(),
    university_id: z.string().uuid().optional(),
    organizationType: z.enum(['UNIVERSITY', 'INSTITUTION']).optional(),
    organization_type: z.enum(['UNIVERSITY', 'INSTITUTION']).optional(),
    opportunityId: z.string().uuid().optional(),
    opportunity_id: z.string().uuid().optional(),
    courseId: z.string().uuid().optional(),
    microCredentialId: z.string().uuid().optional(),
    role: z.string().max(40).optional(),
    orgMetric: z.enum(['activeUsers', 'students', 'trainingCompletion', 'courseCompletion', 'certificates']).optional(),
    type: z.string().max(40).optional(),
    bucket: z.string().max(20).optional(),
    page: z.coerce.number().int().min(1).max(500).optional(),
    pageSize: z.coerce.number().int().min(1).max(50).optional(),
    activityCategory: z.string().max(40).optional(),
  })
  .transform((q) => ({
    ...q,
    dateFrom: q.dateFrom || q.from,
    dateTo: q.dateTo || q.to,
    organizationId: q.organizationId || q.organization_id,
    universityId: q.universityId || q.university_id,
    organizationType: q.organizationType || q.organization_type,
    opportunityId: q.opportunityId || q.opportunity_id,
  }));

module.exports = {
  analyticsQuerySchema,
  commandCenterQuerySchema,
};

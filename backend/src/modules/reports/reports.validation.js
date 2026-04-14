const { z } = require('zod');

const reportsQuerySchema = z
  .object({
    university_id: z.string().uuid().optional(),
    track_id: z.string().uuid().optional(),
    micro_credential_id: z.string().uuid().optional(),
    cohort_id: z.string().uuid().optional(),
    from: z.string().max(40).optional(),
    to: z.string().max(40).optional(),
    format: z.enum(['json', 'csv']).optional(),
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
      format: q.format || 'json',
    };
  });

const reportTypeParamSchema = z.object({
  type: z.enum(['universities', 'cohorts', 'attendance', 'assessments', 'recognition', 'certificates']),
});

module.exports = {
  reportsQuerySchema,
  reportTypeParamSchema,
};

const { z } = require('zod');

const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid id'),
});

const attendanceStatusEnum = z.enum(['present', 'late', 'absent', 'excused']);

const saveAttendanceBodySchema = z
  .object({
    records: z
      .array(
        z
          .object({
            student_id: z.string().uuid(),
            attendance_status: attendanceStatusEnum,
            notes: z.string().max(1000).optional().nullable(),
          })
          .strict()
      )
      .min(1, 'At least one record is required'),
  })
  .strict();

const patchAttendanceRecordBodySchema = z
  .object({
    attendance_status: attendanceStatusEnum.optional(),
    notes: z.string().max(1000).optional().nullable(),
  })
  .strict()
  .refine((b) => b.attendance_status !== undefined || b.notes !== undefined, {
    message: 'At least one field is required',
  });

module.exports = {
  uuidParamSchema,
  saveAttendanceBodySchema,
  patchAttendanceRecordBodySchema,
  attendanceStatusEnum,
};

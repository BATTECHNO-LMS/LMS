const { z } = require('zod');
const { MAJOR_TO_TRACK, MIN_HOURS, MAX_HOURS, HOURS_STEP } = require('./internshipJourney.constants');

const MAJOR_CODE_ENUM = /** @type {[string, ...string[]]} */ (Object.keys(MAJOR_TO_TRACK));

const academicProfileBodySchema = z
  .object({
    universityId: z.string().uuid().optional().nullable(),
    universityName: z.string().trim().min(1, 'يرجى اختيار الجامعة.').max(255),
    isOtherUniversity: z.boolean().optional().default(false),
    facultyCode: z.string().trim().min(1, 'يرجى اختيار الكلية.').max(80),
    facultyName: z.string().trim().min(1, 'يرجى اختيار الكلية.').max(255),
    isOtherFaculty: z.boolean().optional().default(false),
    majorCode: z.enum(MAJOR_CODE_ENUM, { errorMap: () => ({ message: 'يرجى اختيار التخصص.' }) }),
    trainingHours: z
      .number({ invalid_type_error: 'يرجى تحديد عدد ساعات التدريب.' })
      .int('يرجى تحديد عدد ساعات التدريب.')
      .min(MIN_HOURS, `الحد الأدنى ${MIN_HOURS} ساعة.`)
      .max(MAX_HOURS, `الحد الأقصى ${MAX_HOURS} ساعة.`)
      .refine((h) => (h - MIN_HOURS) % HOURS_STEP === 0, {
        message: `يجب أن تكون الساعات من مضاعفات ${HOURS_STEP}.`,
      }),
    trackCode: z.string().trim().max(80).optional(),
  })
  .strict();

module.exports = { academicProfileBodySchema };

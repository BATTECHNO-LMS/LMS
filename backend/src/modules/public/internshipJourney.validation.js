const { z } = require('zod');
const { MIN_HOURS, MAX_HOURS, HOURS_STEP } = require('./internshipJourney.constants');
const { FACULTIES, MAJOR_TO_TRACK, OTHER_FACULTY, OTHER_MAJOR } = require('./internshipJourney.taxonomy');
const { OTHER_UNIVERSITY } = require('./internshipJourney.universities');

const facultyCodes = /** @type {[string, ...string[]]} */ (Object.keys(FACULTIES));
const majorCodes = /** @type {[string, ...string[]]} */ ([...Object.keys(MAJOR_TO_TRACK), OTHER_MAJOR]);

const academicProfileBodySchema = z
  .object({
    universityCode: z.string().trim().min(1, 'يرجى اختيار الجامعة.').max(80),
    universityName: z.string().trim().min(1, 'يرجى اختيار الجامعة.').max(255),
    isOtherUniversity: z.boolean().optional().default(false),
    eprojectoUniversityId: z.string().uuid().optional().nullable(),
    facultyCode: z.enum(facultyCodes, { errorMap: () => ({ message: 'يرجى اختيار الكلية.' }) }),
    facultyName: z.string().trim().min(1, 'يرجى اختيار الكلية.').max(255),
    facultyCustomName: z.string().trim().max(255).optional().nullable(),
    isOtherFaculty: z.boolean().optional().default(false),
    majorCode: z.enum(majorCodes, { errorMap: () => ({ message: 'يرجى اختيار التخصص.' }) }),
    majorCustomName: z.string().trim().max(255).optional().nullable(),
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
  .strict()
  .superRefine((data, ctx) => {
    if (data.universityCode === OTHER_UNIVERSITY && !data.isOtherUniversity) {
      // tolerate missing flag if code is OTHER
    }
    if (data.facultyCode === OTHER_FACULTY && !(data.facultyCustomName || data.facultyName)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'يرجى إدخال اسم الكلية.', path: ['faculty'] });
    }
    if (
      (data.facultyCode === OTHER_FACULTY || data.majorCode === OTHER_MAJOR || String(data.majorCode).startsWith('OTHER_')) &&
      !data.majorCustomName
    ) {
      // OTHER_BUSINESS / OTHER_IT also need custom name — enforced in service for clarity
    }
  });

module.exports = { academicProfileBodySchema, OTHER_UNIVERSITY, OTHER_FACULTY, OTHER_MAJOR };

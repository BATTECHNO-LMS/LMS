import { z } from 'zod';

export const userSchema = z.object({
  name: z.string().min(1, 'الاسم مطلوب'),
  email: z.string().min(1, 'البريد مطلوب').email('صيغة البريد غير صالحة'),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
  role: z.enum(['instructor', 'student', 'program_admin', 'qa_officer', 'academic_admin'], {
    required_error: 'الدور مطلوب',
  }),
  status: z.enum(['active', 'inactive', 'suspended'], { required_error: 'الحالة مطلوبة' }),
});

export const userUpdateSchema = z.object({
  name: z.string().min(1, 'الاسم مطلوب'),
  role: z.enum(['instructor', 'student', 'program_admin', 'qa_officer', 'academic_admin'], {
    required_error: 'الدور مطلوب',
  }),
  status: z.enum(['active', 'inactive', 'suspended'], { required_error: 'الحالة مطلوبة' }),
  phone: z.string().max(50).optional(),
});

export const universitySchema = z.object({
  name: z.string().min(1, 'اسم الجامعة مطلوب'),
  contact: z.string().min(1, 'جهة الاتصال مطلوبة'),
  email: z.string().min(1, 'البريد مطلوب').email('صيغة البريد غير صالحة'),
  status: z.enum(['active', 'inactive', 'archived'], { required_error: 'الحالة مطلوبة' }),
  programs: z.preprocess(
    (v) => (v === '' || v === undefined || v === null ? undefined : v),
    z.coerce.number().min(0, 'القيمة غير صالحة').optional()
  ),
});

export const trackSchema = z.object({
  name: z.string().min(1, 'اسم المسار مطلوب'),
  code: z.string().min(1, 'الرمز مطلوب'),
  description: z.string().max(5000).optional().or(z.literal('')),
  status: z.enum(['active', 'inactive', 'archived'], { required_error: 'الحالة مطلوبة' }),
});

const deliveryModeEnum = z.enum(['online', 'onsite', 'hybrid', 'self_paced'], {
  required_error: 'نمط التقديم مطلوب',
});
const internalApprovalEnum = z.enum(['not_started', 'in_review', 'approved', 'rejected']);
const microCredentialStatusEnum = z.enum(['draft', 'under_review', 'approved', 'active', 'archived']);

export const microCredentialSchema = z.object({
  title: z.string().min(1, 'العنوان مطلوب'),
  code: z.string().min(1, 'الرمز مطلوب'),
  track_id: z.string().uuid('المسار مطلوب'),
  level: z.string().min(1, 'المستوى مطلوب'),
  duration_hours: z.preprocess(
    (v) => (v === '' || v === undefined || v === null ? undefined : v),
    z.coerce.number().min(0.01, 'الساعات يجب أن تكون أكبر من صفر')
  ),
  delivery_mode: deliveryModeEnum,
  description: z.string().max(10000).optional().or(z.literal('')),
  prerequisites: z.string().max(10000).optional().or(z.literal('')),
  passing_policy: z.string().max(10000).optional().or(z.literal('')),
  attendance_policy: z.string().max(10000).optional().or(z.literal('')),
  internal_approval_status: internalApprovalEnum.optional(),
  status: microCredentialStatusEnum.optional(),
  university_ids: z.array(z.string().uuid()).optional(),
});

export const learningOutcomeSchema = z.object({
  outcome_code: z.string().min(1, 'رمز المخرج مطلوب').max(80),
  outcome_text: z.string().min(1, 'نص المخرج مطلوب'),
  outcome_type: z.string().max(100).optional().or(z.literal('')),
});

const cohortStatusEnum = z.enum(
  ['planned', 'open_for_enrollment', 'active', 'completed', 'closed', 'cancelled'],
  { required_error: 'الحالة مطلوبة' }
);

export const cohortSchema = z
  .object({
    title: z.string().min(1, 'عنوان الدفعة مطلوب'),
    micro_credential_id: z.string().uuid('الشهادة مطلوبة'),
    university_id: z.string().uuid('الجامعة مطلوبة'),
    instructor_id: z.preprocess(
      (v) => (v === '' || v === undefined || v === null ? undefined : v),
      z.string().uuid().optional()
    ),
    capacity: z.preprocess(
      (v) => (v === '' || v === undefined || v === null ? undefined : v),
      z.coerce.number().int().min(1, 'السعة يجب أن تكون 1 على الأقل')
    ),
    start_date: z.string().min(1, 'تاريخ البداية مطلوب'),
    end_date: z.string().min(1, 'تاريخ النهاية مطلوب'),
    status: cohortStatusEnum,
  })
  .refine((d) => new Date(d.end_date) >= new Date(d.start_date), {
    message: 'تاريخ النهاية يجب أن يكون بعد أو مساوي لتاريخ البداية',
    path: ['end_date'],
  });

export const sessionSchema = z
  .object({
    title: z.string().min(1, 'عنوان الجلسة مطلوب'),
    session_date: z.string().min(1, 'تاريخ الجلسة مطلوب'),
    start_time: z.string().min(1, 'وقت البداية مطلوب'),
    end_time: z.string().min(1, 'وقت النهاية مطلوب'),
    session_type: z.enum(['lecture', 'lab', 'workshop', 'review', 'assessment', 'other'], {
      required_error: 'نوع الجلسة مطلوب',
    }),
    module_id: z.preprocess(
      (v) => (v === '' || v === undefined || v === null ? undefined : v),
      z.string().uuid().optional()
    ),
    notes: z.string().max(5000).optional().or(z.literal('')),
  })
  .refine(
    (d) => {
      const norm = (s) => String(s ?? '').trim().slice(0, 5);
      const [sh, sm] = norm(d.start_time).split(':').map(Number);
      const [eh, em] = norm(d.end_time).split(':').map(Number);
      if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return true;
      const s = sh * 60 + sm;
      const e = eh * 60 + em;
      return e > s;
    },
    { message: 'وقت النهاية يجب أن يكون بعد وقت البداية', path: ['end_time'] }
  );

export const enrollmentCreateSchema = z.object({
  student_id: z.string().uuid('الطالب مطلوب'),
});

const assessmentTypeApiEnum = z.enum(
  ['quiz', 'assignment', 'lab', 'practical_exam', 'milestone', 'capstone_project', 'presentation'],
  { required_error: 'النوع مطلوب' }
);

const assessmentStatusApiEnum = z.enum(['draft', 'published', 'open', 'closed', 'archived'], {
  required_error: 'الحالة مطلوبة',
});

/** Payload aligned with POST/PUT /api/assessments */
export const assessmentApiSchema = z.object({
  title: z.string().min(1, 'العنوان مطلوب'),
  assessment_type: assessmentTypeApiEnum,
  weight: z.preprocess(
    (v) => (v === '' || v === undefined || v === null ? undefined : v),
    z.coerce.number().gt(0, 'الوزن يجب أن يكون أكبر من صفر').max(100, 'الوزن يجب ألا يتجاوز 100')
  ),
  cohort_id: z.string().uuid('الدفعة مطلوبة'),
  micro_credential_id: z.string().uuid('الشهادة المصغّرة مطلوبة'),
  due_date: z.string().min(1, 'تاريخ الاستحقاق مطلوب'),
  open_at: z.preprocess(
    (v) => (v === '' || v === undefined || v === null ? undefined : v),
    z.string().max(40).optional()
  ),
  linked_outcome_id: z.preprocess(
    (v) => (v === '' || v === undefined || v === null ? undefined : v),
    z.string().uuid().optional()
  ),
  rubric_id: z.preprocess(
    (v) => (v === '' || v === undefined || v === null ? undefined : v),
    z.string().uuid().optional()
  ),
  instructions: z.string().max(20000).optional().or(z.literal('')),
  status: assessmentStatusApiEnum.optional(),
});

export const recognitionSchema = z.object({
  title: z.string().min(1, 'عنوان الطلب مطلوب'),
  universityId: z.string().min(1, 'الجامعة مطلوبة'),
  universityName: z.string().optional(),
  credentialName: z.string().min(1, 'اسم الشهادة مطلوب'),
  cohortName: z.string().min(1, 'اسم الدفعة مطلوب'),
  status: z.enum(['draft', 'pending', 'approved', 'rejected'], { required_error: 'الحالة مطلوبة' }),
});

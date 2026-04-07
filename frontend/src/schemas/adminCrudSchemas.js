import { z } from 'zod';

export const userSchema = z.object({
  name: z.string().min(1, 'الاسم مطلوب'),
  email: z.string().min(1, 'البريد مطلوب').email('صيغة البريد غير صالحة'),
  role: z.string().min(1, 'الدور مطلوب'),
  status: z.enum(['active', 'inactive'], { required_error: 'الحالة مطلوبة' }),
});

export const universitySchema = z.object({
  name: z.string().min(1, 'اسم الجامعة مطلوب'),
  contact: z.string().min(1, 'جهة الاتصال مطلوبة'),
  email: z.string().min(1, 'البريد مطلوب').email('صيغة البريد غير صالحة'),
  status: z.enum(['active', 'inactive', 'suspended'], { required_error: 'الحالة مطلوبة' }),
  programs: z.preprocess(
    (v) => (v === '' || v === undefined || v === null ? undefined : v),
    z.coerce.number().min(0, 'القيمة غير صالحة').optional()
  ),
});

export const trackSchema = z.object({
  name: z.string().min(1, 'اسم المسار مطلوب'),
  code: z.string().min(1, 'الرمز مطلوب'),
  level: z.string().min(1, 'المستوى مطلوب'),
  status: z.enum(['active', 'draft', 'inactive'], { required_error: 'الحالة مطلوبة' }),
});

export const microCredentialSchema = z.object({
  name: z.string().min(1, 'الاسم مطلوب'),
  code: z.string().min(1, 'الرمز مطلوب'),
  level: z.string().min(1, 'المستوى مطلوب'),
  hours: z.preprocess(
    (v) => (v === '' || v === undefined || v === null ? undefined : v),
    z.coerce.number().min(1, 'الساعات يجب أن تكون أكبر من صفر')
  ),
  status: z.enum(['draft', 'approved', 'archived'], { required_error: 'الحالة مطلوبة' }),
  trackId: z.string().min(1, 'المسار مطلوب'),
});

export const cohortSchema = z
  .object({
    name: z.string().min(1, 'اسم الدفعة مطلوب'),
    credentialId: z.string().min(1, 'الشهادة مطلوبة'),
    credentialName: z.string().optional(),
    universityId: z.string().min(1, 'الجامعة مطلوبة'),
    universityName: z.string().optional(),
    instructor: z.string().min(1, 'المدرّب مطلوب'),
    startDate: z.string().min(1, 'تاريخ البداية مطلوب'),
    endDate: z.string().min(1, 'تاريخ النهاية مطلوب'),
    status: z.enum(['planned', 'running', 'completed', 'cancelled'], { required_error: 'الحالة مطلوبة' }),
  })
  .refine((d) => new Date(d.endDate) >= new Date(d.startDate), {
    message: 'تاريخ النهاية يجب أن يكون بعد أو مساوي لتاريخ البداية',
    path: ['endDate'],
  });

export const assessmentSchema = z.object({
  name: z.string().min(1, 'اسم التقييم مطلوب'),
  type: z.string().min(1, 'النوع مطلوب'),
  weight: z.preprocess(
    (v) => (v === '' || v === undefined || v === null ? undefined : v),
    z.coerce.number().min(0, 'الوزن غير صالح').max(100, 'الوزن يجب ألا يتجاوز 100')
  ),
  cohortId: z.string().min(1, 'الدفعة مطلوبة'),
  cohortName: z.string().optional(),
  dueDate: z.string().min(1, 'تاريخ الاستحقاق مطلوب'),
  status: z.enum(['draft', 'pending', 'published', 'closed'], { required_error: 'الحالة مطلوبة' }),
});

export const recognitionSchema = z.object({
  title: z.string().min(1, 'عنوان الطلب مطلوب'),
  universityId: z.string().min(1, 'الجامعة مطلوبة'),
  universityName: z.string().optional(),
  credentialName: z.string().min(1, 'اسم الشهادة مطلوب'),
  cohortName: z.string().min(1, 'اسم الدفعة مطلوب'),
  status: z.enum(['draft', 'pending', 'approved', 'rejected'], { required_error: 'الحالة مطلوبة' }),
});

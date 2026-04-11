import { z } from 'zod';
import { MOCK_UNIVERSITIES } from '../../../constants/universities.js';
import { getEmailDomain, isEmailDomainAllowed } from '../../../utils/emailDomain.js';

/**
 * @param {(key: string) => string} t - i18next `t` bound to `auth` namespace
 */
export function createRegisterStudentSchema(t) {
  const universityIds = MOCK_UNIVERSITIES.map((u) => u.id);

  return z
    .object({
      full_name: z.string().min(1, t('register.errors.required')),
      email: z
        .string()
        .min(1, t('register.errors.required'))
        .email(t('register.errors.invalidEmail')),
      password: z.string().min(6, t('register.errors.passwordShort')),
      confirm_password: z.string().min(1, t('register.errors.required')),
      university: z
        .string()
        .min(1, t('register.errors.required'))
        .refine((id) => universityIds.includes(id), t('register.errors.required')),
      phone: z.string().optional(),
    })
    .refine((data) => data.password === data.confirm_password, {
      message: t('register.errors.passwordMismatch'),
      path: ['confirm_password'],
    })
    .superRefine((data, ctx) => {
      const uni = MOCK_UNIVERSITIES.find((u) => u.id === data.university);
      if (!uni) return;

      const domain = getEmailDomain(data.email);
      if (!domain) return;

      if (!isEmailDomainAllowed(domain, uni.domains)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['email'],
          message: t('register.errors.emailDomainMismatch'),
        });
      }
    });
}

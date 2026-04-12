import { z } from 'zod';

/**
 * @param {(key: string) => string} t - i18next `t` bound to `auth` namespace
 */
export function createRegisterStudentSchema(t) {
  return z
    .object({
      full_name: z.string().min(1, t('register.errors.required')),
      email: z
        .string()
        .min(1, t('register.errors.required'))
        .email(t('register.errors.invalidEmail')),
      password: z.string().min(6, t('register.errors.passwordShort')),
      confirm_password: z.string().min(1, t('register.errors.required')),
      university: z.string().uuid(t('register.errors.required')),
      phone: z.string().optional(),
    })
    .refine((data) => data.password === data.confirm_password, {
      message: t('register.errors.passwordMismatch'),
      path: ['confirm_password'],
    });
}

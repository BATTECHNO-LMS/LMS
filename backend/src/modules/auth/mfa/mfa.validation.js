'use strict';

const { z } = require('zod');

const challengeToken = z.string().min(20).max(200);
/** Digits with optional spaces/dashes from paste; strict format is enforced in totp.normalizeTotpCode. */
const totpCode = z.string().trim().min(6).max(12);
const recoveryCode = z.string().trim().min(8).max(32);
const password = z.string().min(1, 'كلمة المرور مطلوبة').max(256);

const challengeVerifySchema = z
  .object({ challengeToken, code: totpCode.optional(), recoveryCode: recoveryCode.optional() })
  .strict()
  .refine((b) => Boolean(b.code) !== Boolean(b.recoveryCode), { message: 'أدخل رمز التحقق أو رمز استرداد.' });

const challengeOnlySchema = z.object({ challengeToken }).strict();
const challengeCodeSchema = z.object({ challengeToken, code: totpCode }).strict();
const enrollCompleteSchema = z.object({ challengeToken, acknowledged: z.literal(true) }).strict();

const setupStartSchema = z.object({ password }).strict();
const codeOnlySchema = z.object({ code: totpCode }).strict();
const passwordAndCodeSchema = z.object({ password, code: totpCode }).strict();

const sessionIdParamSchema = z.object({ id: z.string().uuid() });

const adminMfaResetSchema = z
  .object({ reason: z.string().trim().min(10, 'يرجى كتابة سبب واضح (10 أحرف على الأقل).').max(500) })
  .strict();

module.exports = {
  challengeVerifySchema,
  challengeOnlySchema,
  challengeCodeSchema,
  enrollCompleteSchema,
  setupStartSchema,
  codeOnlySchema,
  passwordAndCodeSchema,
  sessionIdParamSchema,
  adminMfaResetSchema,
};

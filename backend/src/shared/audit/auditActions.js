'use strict';

/**
 * Central audit action registry.
 *
 * Every `audit_logs.action_type` written by runtime code must be registered here.
 * Action names are stable machine codes: never embed a person's name, email or any
 * other personal value in an action name (put identifiers in entity/subject columns).
 *
 * `legacy: true` marks names kept only so historical rows render with a label.
 */

const AUDIT_CATEGORIES = Object.freeze({
  AUTH: 'AUTH',
  SECURITY: 'SECURITY',
  USER: 'USER',
  ORGANIZATION: 'ORGANIZATION',
  COURSE: 'COURSE',
  ASSIGNMENT: 'ASSIGNMENT',
  FIELD_TRAINING: 'FIELD_TRAINING',
  ATTENDANCE: 'ATTENDANCE',
  ASSESSMENT: 'ASSESSMENT',
  EVALUATION: 'EVALUATION',
  FILE: 'FILE',
  REPORT: 'REPORT',
  CERTIFICATE: 'CERTIFICATE',
  COMPLETION_LETTER: 'COMPLETION_LETTER',
  MICRO_CREDENTIAL: 'MICRO_CREDENTIAL',
  NOTIFICATION: 'NOTIFICATION',
  SYSTEM: 'SYSTEM',
});

const CATEGORY_LABELS = Object.freeze({
  AUTH: { ar: 'الدخول والجلسات', en: 'Authentication' },
  SECURITY: { ar: 'الأمان', en: 'Security' },
  USER: { ar: 'المستخدمون', en: 'Users' },
  ORGANIZATION: { ar: 'المؤسسات والجامعات', en: 'Organizations' },
  COURSE: { ar: 'الدورات', en: 'Courses' },
  ASSIGNMENT: { ar: 'المهام والتكليفات', en: 'Assignments' },
  FIELD_TRAINING: { ar: 'التدريب الميداني', en: 'Field training' },
  ATTENDANCE: { ar: 'الحضور', en: 'Attendance' },
  ASSESSMENT: { ar: 'الاختبارات', en: 'Assessments' },
  EVALUATION: { ar: 'التقييم', en: 'Evaluation' },
  FILE: { ar: 'الملفات', en: 'Files' },
  REPORT: { ar: 'التقارير', en: 'Reports' },
  CERTIFICATE: { ar: 'الشهادات', en: 'Certificates' },
  COMPLETION_LETTER: { ar: 'كتب الإنجاز', en: 'Completion letters' },
  MICRO_CREDENTIAL: { ar: 'الشهادات المصغّرة', en: 'Micro-credentials' },
  NOTIFICATION: { ar: 'الإشعارات والمحتوى', en: 'Notifications' },
  SYSTEM: { ar: 'النظام', en: 'System' },
});

const AUDIT_OUTCOMES = Object.freeze({
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  DENIED: 'DENIED',
  BLOCKED: 'BLOCKED',
});

const OUTCOME_LABELS = Object.freeze({
  SUCCESS: { ar: 'نجاح', en: 'Success' },
  FAILED: { ar: 'فشل', en: 'Failed' },
  DENIED: { ar: 'مرفوض', en: 'Denied' },
  BLOCKED: { ar: 'محظور مؤقتًا', en: 'Blocked' },
});

/** Security-relevant categories: writes are retried and failures are logged at error level. */
const SECURITY_CRITICAL_CATEGORIES = new Set(['AUTH', 'SECURITY']);

/**
 * Security-event taxonomy (`audit_logs.security_category`). A row is a security event when
 * its action is registered with `security`. Callers can never pass free-text categories.
 */
const SECURITY_CATEGORIES = Object.freeze({
  AUTHENTICATION: 'AUTHENTICATION',
  AUTHORIZATION: 'AUTHORIZATION',
  RATE_LIMIT: 'RATE_LIMIT',
  SESSION: 'SESSION',
  ACCOUNT_SECURITY: 'ACCOUNT_SECURITY',
  SYSTEM_SECURITY: 'SYSTEM_SECURITY',
});

const SECURITY_CATEGORY_LABELS = Object.freeze({
  AUTHENTICATION: { ar: 'التحقق من الهوية', en: 'Authentication' },
  AUTHORIZATION: { ar: 'الصلاحيات', en: 'Authorization' },
  RATE_LIMIT: { ar: 'تقييد المعدل', en: 'Rate limiting' },
  SESSION: { ar: 'الجلسات', en: 'Sessions' },
  ACCOUNT_SECURITY: { ar: 'أمان الحساب', en: 'Account security' },
  SYSTEM_SECURITY: { ar: 'أمان النظام', en: 'System security' },
});

/** `audit_logs.severity`. A single failed login is INFO; HIGH/CRITICAL are reserved for attacks. */
const SECURITY_SEVERITIES = Object.freeze({
  INFO: 'INFO',
  WARNING: 'WARNING',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
});

const SEVERITY_LABELS = Object.freeze({
  INFO: { ar: 'معلومة', en: 'Info' },
  WARNING: { ar: 'تحذير', en: 'Warning' },
  HIGH: { ar: 'مرتفع', en: 'High' },
  CRITICAL: { ar: 'حرج', en: 'Critical' },
});

const C = AUDIT_CATEGORIES;
const S = SECURITY_CATEGORIES;
const V = SECURITY_SEVERITIES;
/** @type {Record<string, { category: string, labelAr: string, labelEn: string, legacy?: boolean, subjectFromEntity?: boolean, security?: { category: string, severity: string } }>} */
const registry = {};

function a(action, category, labelAr, labelEn, opts = {}) {
  const { security, ...rest } = opts;
  registry[action] = Object.freeze({
    category,
    labelAr,
    labelEn,
    ...rest,
    ...(security ? { security: Object.freeze({ category: security[0], severity: security[1] }) } : {}),
  });
}

// ── AUTH ────────────────────────────────────────────────────────────────────
a('USER_LOGIN_SUCCESS', C.AUTH, 'تسجيل دخول ناجح', 'Login succeeded', { security: [S.AUTHENTICATION, V.INFO] });
a('USER_LOGIN_FAILED', C.AUTH, 'محاولة دخول فاشلة', 'Login failed', { security: [S.AUTHENTICATION, V.INFO] });
a('LOGIN_ACCOUNT_DENIED', C.AUTH, 'رفض الدخول بسبب حالة الحساب', 'Login denied (account state)', {
  security: [S.AUTHENTICATION, V.INFO],
});
a('AUTH_SESSION_CREATED', C.AUTH, 'بدأت جلسة تسجيل الدخول', 'Session started', { security: [S.SESSION, V.INFO] });
a('AUTH_SESSION_ACTIVITY_STARTED', C.AUTH, 'بدء النشاط في الجلسة', 'Session activity started', {
  security: [S.SESSION, V.INFO],
});
a('AUTH_SESSION_IDLE_TIMEOUT', C.AUTH, 'انتهت الجلسة لعدم النشاط', 'Session ended (idle timeout)', {
  security: [S.SESSION, V.INFO],
});
a('AUTH_SESSION_ABSOLUTE_EXPIRED', C.AUTH, 'انتهت صلاحية الجلسة', 'Session expired (maximum lifetime)', {
  security: [S.SESSION, V.INFO],
});
/** The user ended one of their own sessions (or, historically, any revocation — see newValues.endReason). */
a('AUTH_SESSION_ENDED', C.AUTH, 'تم إنهاء جلسة', 'Session ended', { security: [S.SESSION, V.INFO] });
/** Forced end: admin, password reset, role/scope/status change, MFA reset (see newValues.endReason). */
a('AUTH_SESSION_REVOKED', C.AUTH, 'تم إنهاء الجلسة أمنيًا', 'Session revoked', { security: [S.SESSION, V.WARNING] });
a('AUTH_OTHER_SESSIONS_ENDED', C.SECURITY, 'تم إنهاء جميع الجلسات الأخرى', 'All other sessions ended', {
  security: [S.SESSION, V.INFO],
});
a('USER_LOGOUT', C.AUTH, 'تم تسجيل الخروج', 'Logout', { security: [S.SESSION, V.INFO] });
a('USER_REGISTERED', C.AUTH, 'تسجيل حساب جديد', 'User registered', { subjectFromEntity: true });
a('INSTITUTION_USER_REGISTERED', C.AUTH, 'تسجيل حساب مؤسسة', 'Institution user registered', {
  subjectFromEntity: true,
});
a('PASSWORD_RESET_REQUESTED', C.AUTH, 'طلب استعادة كلمة المرور', 'Password reset requested', {
  subjectFromEntity: true,
  security: [S.ACCOUNT_SECURITY, V.INFO],
});
a('PASSWORD_RESET_OTP_VERIFIED', C.AUTH, 'التحقق من رمز الاستعادة', 'Password reset code verified', {
  subjectFromEntity: true,
  security: [S.ACCOUNT_SECURITY, V.INFO],
});
a('PASSWORD_RESET_COMPLETED', C.AUTH, 'إعادة تعيين كلمة المرور', 'Password reset completed', {
  subjectFromEntity: true,
  security: [S.ACCOUNT_SECURITY, V.INFO],
});

// ── SECURITY ────────────────────────────────────────────────────────────────
a('TOKEN_INVALID', C.SECURITY, 'رمز دخول غير صالح', 'Invalid token', { security: [S.AUTHENTICATION, V.WARNING] });
a('TOKEN_EXPIRED', C.SECURITY, 'رمز دخول منتهي', 'Expired token', { security: [S.SESSION, V.INFO] });
a('AUTHORIZATION_DENIED', C.SECURITY, 'رفض صلاحية الوصول', 'Authorization denied', {
  security: [S.AUTHORIZATION, V.WARNING],
});
a('CROSS_SCOPE_ACCESS_DENIED', C.SECURITY, 'محاولة وصول إلى جهة أخرى', 'Cross-scope access denied', {
  security: [S.AUTHORIZATION, V.HIGH],
});
a('RATE_LIMIT_TRIGGERED', C.SECURITY, 'تجاوز حد الطلبات', 'Rate limit triggered', {
  security: [S.RATE_LIMIT, V.WARNING],
});
a('LOGIN_BRUTE_FORCE_SUSPECTED', C.SECURITY, 'اشتباه بهجوم تخمين كلمة المرور', 'Login brute force suspected', {
  security: [S.AUTHENTICATION, V.HIGH],
});
a('OTP_FAILED', C.SECURITY, 'رمز تحقق خاطئ', 'Verification code failed', {
  subjectFromEntity: true,
  security: [S.ACCOUNT_SECURITY, V.INFO],
});
a('OTP_LOCKED_TEMPORARILY', C.SECURITY, 'إيقاف رمز التحقق مؤقتًا', 'Verification code locked', {
  subjectFromEntity: true,
  security: [S.ACCOUNT_SECURITY, V.WARNING],
});
a('OTP_RATE_LIMITED', C.SECURITY, 'تجاوز محاولات رمز التحقق', 'Verification code attempts exceeded', {
  subjectFromEntity: true,
  security: [S.RATE_LIMIT, V.WARNING],
});
// MFA — never carries a secret, code, QR or recovery code (only outcome / method / counts).
a('MFA_ENROLLMENT_STARTED', C.SECURITY, 'بدء إعداد المصادقة الثنائية', 'MFA enrollment started', {
  security: [S.ACCOUNT_SECURITY, V.INFO],
});
a('MFA_ENABLED', C.SECURITY, 'تم تفعيل المصادقة الثنائية', 'MFA enabled', { security: [S.ACCOUNT_SECURITY, V.INFO] });
a('MFA_DISABLED', C.SECURITY, 'تم إيقاف المصادقة الثنائية', 'MFA disabled', {
  security: [S.ACCOUNT_SECURITY, V.WARNING],
});
a('MFA_CHALLENGE_CREATED', C.SECURITY, 'طلب التحقق الثنائي', 'MFA challenge created', {
  security: [S.AUTHENTICATION, V.INFO],
});
a('MFA_CHALLENGE_SUCCESS', C.SECURITY, 'نجح التحقق الثنائي', 'MFA challenge succeeded', {
  security: [S.AUTHENTICATION, V.INFO],
});
a('MFA_CHALLENGE_FAILED', C.SECURITY, 'فشل التحقق الثنائي', 'MFA challenge failed', {
  security: [S.AUTHENTICATION, V.INFO],
});
a('MFA_RATE_LIMIT_TRIGGERED', C.SECURITY, 'إيقاف مؤقت لمحاولات التحقق الثنائي', 'MFA attempts throttled', {
  security: [S.RATE_LIMIT, V.HIGH],
});
a('MFA_RECOVERY_CODE_USED', C.SECURITY, 'تم استخدام رمز استرداد', 'Recovery code used', {
  security: [S.ACCOUNT_SECURITY, V.WARNING],
});
a('MFA_RECOVERY_CODES_REGENERATED', C.SECURITY, 'تم إعادة إنشاء رموز الاسترداد', 'Recovery codes regenerated', {
  security: [S.ACCOUNT_SECURITY, V.INFO],
});
a('MFA_RESET_BY_ADMIN', C.SECURITY, 'تمت إعادة ضبط المصادقة الثنائية بواسطة المسؤول', 'MFA reset by administrator', {
  security: [S.ACCOUNT_SECURITY, V.HIGH],
});
a('MFA_ADMIN_RESET_DENIED', C.SECURITY, 'رفض إعادة ضبط المصادقة الثنائية', 'MFA reset denied', {
  security: [S.AUTHORIZATION, V.HIGH],
});
a('MFA_STEP_UP_SUCCESS', C.SECURITY, 'نجحت إعادة المصادقة لعملية حساسة', 'Step-up authentication succeeded', {
  security: [S.AUTHENTICATION, V.INFO],
});
a('MFA_STEP_UP_FAILED', C.SECURITY, 'فشلت إعادة المصادقة لعملية حساسة', 'Step-up authentication failed', {
  security: [S.AUTHENTICATION, V.INFO],
});
a('PERMISSION_DENIED', C.SECURITY, 'محاولة وصول غير مصرّح بها', 'Permission denied', {
  legacy: true,
  security: [S.AUTHORIZATION, V.WARNING],
});
a('ACCOUNT_DELETION_REQUESTED', C.USER, 'طلب حذف الحساب', 'Account deletion requested');
a('ACCOUNT_DELETION_CANCELLED', C.USER, 'إلغاء طلب حذف الحساب', 'Account deletion cancelled');
a('ACCOUNT_DELETION_PROCESSING', C.USER, 'معالجة طلب حذف الحساب', 'Account deletion processing');
a('ACCOUNT_DELETION_REJECTED', C.USER, 'رفض طلب حذف الحساب', 'Account deletion rejected');
a('ACCOUNT_DELETION_COMPLETED', C.USER, 'اكتمال حذف الحساب', 'Account deletion completed');

// ── USER ────────────────────────────────────────────────────────────────────
a('USER_CREATED', C.USER, 'إنشاء مستخدم', 'User created', { subjectFromEntity: true });
a('USER_UPDATED', C.USER, 'تعديل بيانات مستخدم', 'User updated', { subjectFromEntity: true });
a('USER_ROLE_CHANGED', C.USER, 'تغيير صلاحيات مستخدم', 'User roles changed', {
  subjectFromEntity: true,
  security: [S.ACCOUNT_SECURITY, V.WARNING],
});
a('USER_STATUS_CHANGED', C.USER, 'تغيير حالة مستخدم', 'User status changed', {
  subjectFromEntity: true,
  security: [S.ACCOUNT_SECURITY, V.INFO],
});
a('USER_PASSWORD_RESET', C.USER, 'إعادة تعيين كلمة مرور مستخدم', 'User password reset by admin', {
  subjectFromEntity: true,
  security: [S.ACCOUNT_SECURITY, V.WARNING],
});
a('USER_ACTIVATED', C.USER, 'تفعيل مستخدم', 'User activated', { subjectFromEntity: true });
a('USER_EMAIL_VERIFIED', C.USER, 'توثيق بريد مستخدم', 'User email verified', { subjectFromEntity: true });
a('BULK_EMAIL_VERIFIED', C.USER, 'توثيق بريد جماعي', 'Bulk email verification');
a('USERS_EXCEL_EXPORTED', C.REPORT, 'تصدير المستخدمين (Excel)', 'Users exported (Excel)');
a('ROLE_PERMISSIONS_UPDATED', C.USER, 'تعديل صلاحيات دور', 'Role permissions updated', {
  security: [S.ACCOUNT_SECURITY, V.WARNING],
});
a('REVIEWER_UNIVERSITY_ASSIGNED', C.USER, 'ربط مراجع بجامعة', 'Reviewer assigned to university');
a('REVIEWER_UNIVERSITY_UNASSIGNED', C.USER, 'إلغاء ربط مراجع بجامعة', 'Reviewer unassigned');
a('TRAINER_USER_CREATED', C.USER, 'إنشاء حساب مدرب', 'Trainer account created', { subjectFromEntity: true });

// ── ORGANIZATION ───────────────────────────────────────────────────────────
a('ORGANIZATION_CREATED', C.ORGANIZATION, 'إنشاء مؤسسة', 'Organization created');
a('ORGANIZATION_UPDATED', C.ORGANIZATION, 'تعديل مؤسسة', 'Organization updated');
a('ORG_BRANCH_CREATED', C.ORGANIZATION, 'إنشاء فرع', 'Branch created');
a('ORG_BRANCH_UPDATED', C.ORGANIZATION, 'تعديل فرع', 'Branch updated');
a('ORG_DEPARTMENT_CREATED', C.ORGANIZATION, 'إنشاء قسم', 'Department created');
a('ORG_ASSIGNMENT_CREATED', C.ORGANIZATION, 'ربط مستخدم بمؤسسة', 'User assigned to organization');
a('EMAIL_VERIFIED_ADMIN', C.USER, 'توثيق بريد عضو المؤسسة', 'Member email verified', { subjectFromEntity: true });
a('ACCOUNT_ACTIVATE', C.USER, 'تفعيل حساب عضو', 'Member account activated', { subjectFromEntity: true });
a('ACCOUNT_REJECT', C.USER, 'رفض حساب عضو', 'Member account rejected', { subjectFromEntity: true });
a('ACCOUNT_DISABLE', C.USER, 'تعطيل حساب عضو', 'Member account disabled', {
  subjectFromEntity: true,
  security: [S.ACCOUNT_SECURITY, V.INFO],
});
a('UNIVERSITY_CREATED', C.ORGANIZATION, 'إنشاء جامعة', 'University created');
a('UNIVERSITY_UPDATED', C.ORGANIZATION, 'تعديل جامعة', 'University updated');
a('UNIVERSITY_DELETED', C.ORGANIZATION, 'حذف جامعة', 'University deleted');

// ── COURSE ─────────────────────────────────────────────────────────────────
a('COURSE_CREATED', C.COURSE, 'إنشاء دورة', 'Course created');
a('COURSE_UPDATED', C.COURSE, 'تعديل دورة', 'Course updated');
a('COURSE_PUBLISHED', C.COURSE, 'نشر دورة', 'Course published');
a('COURSE_ARCHIVED', C.COURSE, 'أرشفة دورة', 'Course archived');
a('COURSE_SECTION_CREATED', C.COURSE, 'إضافة قسم للدورة', 'Course section created');
a('COURSE_SECTION_UPDATED', C.COURSE, 'تعديل قسم في الدورة', 'Course section updated');
a('COURSE_SECTION_DELETED', C.COURSE, 'حذف قسم من الدورة', 'Course section deleted');
a('COURSE_LESSON_CREATED', C.COURSE, 'إضافة درس', 'Lesson created');
a('COURSE_LESSON_UPDATED', C.COURSE, 'تعديل درس', 'Lesson updated');
a('COURSE_LESSON_DELETED', C.COURSE, 'حذف درس', 'Lesson deleted');
a('COURSE_ENROLLMENT_CREATED', C.COURSE, 'تسجيل متدرب في دورة', 'Enrollment created');
a('COURSE_ENROLLMENT_UPDATED', C.COURSE, 'تعديل تسجيل في دورة', 'Enrollment updated');
a('COURSE_ENROLLMENT_REMOVED', C.COURSE, 'إلغاء تسجيل من دورة', 'Enrollment removed');
a('COURSE_ENROLLMENTS_IMPORTED', C.COURSE, 'استيراد تسجيلات جماعي', 'Enrollments bulk imported');
a('TRAINING_PROGRAM_CREATED', C.COURSE, 'إنشاء برنامج تدريبي', 'Training program created');
a('TRAINING_PROGRAM_PUBLISHED', C.COURSE, 'نشر برنامج تدريبي', 'Training program published');
a('TRAINING_PROGRAM_UPDATED', C.COURSE, 'تعديل برنامج تدريبي', 'Training program updated', { legacy: true });
a('TRAINING_SESSION_UPDATED', C.COURSE, 'تعديل جلسة تدريبية', 'Training session updated');
a('MATERIAL_CREATED', C.COURSE, 'إضافة مادة تعليمية', 'Material created');
a('MATERIAL_UPDATED', C.COURSE, 'تعديل مادة تعليمية', 'Material updated');
a('MATERIAL_FILE_REPLACED', C.COURSE, 'استبدال ملف مادة', 'Material file replaced');
a('TRAINER_ASSIGNED', C.COURSE, 'تعيين مدرب', 'Trainer assigned');
a('TRAINER_ASSIGNMENT_UPDATED', C.COURSE, 'تعديل تعيين مدرب', 'Trainer assignment updated');
a('TRAINER_ASSIGNMENT_REVOKED', C.COURSE, 'إلغاء تعيين مدرب', 'Trainer assignment revoked');
a('TRAINING_FINALIZED', C.COURSE, 'اعتماد نتائج الدورة', 'Course results finalized');
a('TRAINING_REOPENED', C.COURSE, 'إعادة فتح نتيجة متدرب', 'Enrollment completion reopened');
a('enrollment_requested', C.COURSE, 'طلب تسجيل', 'Enrollment requested');
a('enrollment_approved', C.COURSE, 'قبول طلب تسجيل', 'Enrollment approved');
a('enrollment_rejected', C.COURSE, 'رفض طلب تسجيل', 'Enrollment rejected');
a('COURSE_OPENED', C.COURSE, 'فتح دورة', 'Course opened');

// ── ASSIGNMENT (course tasks) ──────────────────────────────────────────────
a('TASK_CREATED', C.ASSIGNMENT, 'إنشاء مهمة', 'Task created');
a('TASK_UPDATED', C.ASSIGNMENT, 'تعديل مهمة', 'Task updated');
a('TASK_DELETED', C.ASSIGNMENT, 'حذف مهمة', 'Task deleted');
a('TRAINING_TASK_SUBMITTED', C.ASSIGNMENT, 'تسليم مهمة', 'Task submitted');
a('TRAINING_TASK_GRADED', C.ASSIGNMENT, 'تقييم مهمة', 'Task graded');
a('TRAINING_TASK_REVISION_REQUESTED', C.ASSIGNMENT, 'طلب تعديل على مهمة', 'Task revision requested');
a('TRAINING_TASK_REOPENED', C.ASSIGNMENT, 'إعادة فتح مهمة', 'Task reopened');
a('ASSIGNMENT_OPENED', C.ASSIGNMENT, 'فتح مهمة', 'Assignment opened');
a('TASK_SUBMITTED', C.ASSIGNMENT, 'تسليم مهمة', 'Task submitted', { legacy: true });
a('TASK_RESUBMITTED', C.ASSIGNMENT, 'إعادة تسليم مهمة', 'Task resubmitted', { legacy: true });

// ── FIELD TRAINING ─────────────────────────────────────────────────────────
a('FIELD_TRAINING_OPPORTUNITY_CREATED', C.FIELD_TRAINING, 'إنشاء فرصة تدريب', 'Opportunity created');
a('FIELD_TRAINING_OPPORTUNITY_UPDATED', C.FIELD_TRAINING, 'تعديل فرصة تدريب', 'Opportunity updated');
a('FIELD_TRAINING_OPPORTUNITY_PUBLISHED', C.FIELD_TRAINING, 'نشر فرصة تدريب', 'Opportunity published');
a('FIELD_TRAINING_OPPORTUNITY_ARCHIVED', C.FIELD_TRAINING, 'أرشفة فرصة تدريب', 'Opportunity archived');
a('FIELD_TRAINING_APPLICATION_SUBMITTED', C.FIELD_TRAINING, 'التقديم على فرصة تدريب', 'Applied to opportunity');
a('FIELD_TRAINING_APPLICATION_CANCELLED', C.FIELD_TRAINING, 'إلغاء طلب التدريب', 'Application cancelled');
a('FIELD_TRAINING_APPLICATION_APPROVED', C.FIELD_TRAINING, 'قبول طلب التدريب', 'Application approved');
a('FIELD_TRAINING_APPLICATION_REJECTED', C.FIELD_TRAINING, 'رفض طلب التدريب', 'Application rejected');
a('FIELD_TRAINING_STARTED', C.FIELD_TRAINING, 'بدء التدريب', 'Training started');
a('FIELD_TRAINING_COMPLETED', C.FIELD_TRAINING, 'اكتمال التدريب', 'Training completed');
a('FIELD_TRAINING_EXPULSION_REQUESTED', C.FIELD_TRAINING, 'طلب فصل متدرب', 'Expulsion requested');
a('FIELD_TRAINING_PARTICIPANT_EXPELLED', C.FIELD_TRAINING, 'فصل متدرب', 'Participant expelled');
a('field_training.hours.update', C.FIELD_TRAINING, 'تعديل ساعات التدريب', 'Training hours adjusted');
a('FIELD_TRAINING_ELIGIBILITY_RECALCULATED', C.FIELD_TRAINING, 'إعادة احتساب الأهلية', 'Eligibility recalculated');
a('FIELD_TRAINING_QUALIFICATION_POLICY_UPDATED', C.FIELD_TRAINING, 'تعديل سياسة التأهل', 'Qualification policy updated');
a('FIELD_TRAINING_140_HOURS_ELIGIBILITY_BACKFILL_V1', C.SYSTEM, 'معالجة ساعات الأهلية (تشغيل نظام)', 'Hours eligibility backfill');
a('FIELD_TRAINING_TASK_CREATED', C.FIELD_TRAINING, 'إنشاء مهمة تدريب', 'Training task created');
a('FIELD_TRAINING_TASK_UPDATED', C.FIELD_TRAINING, 'تعديل مهمة تدريب', 'Training task updated');
a('FIELD_TRAINING_TASK_DELETED', C.FIELD_TRAINING, 'حذف مهمة تدريب', 'Training task deleted');
a('FIELD_TRAINING_TASK_SUBMITTED', C.FIELD_TRAINING, 'تسليم مهمة تدريب', 'Training task submitted');
a('FIELD_TRAINING_SUBMISSION_REVIEWED', C.FIELD_TRAINING, 'تقييم تسليم مهمة', 'Submission reviewed');
a('FIELD_TRAINING_TASK_SUBMISSIONS_BULK_GRADED', C.FIELD_TRAINING, 'تقييم جماعي للتسليمات', 'Submissions bulk graded', {
  legacy: true,
});
a('FIELD_TRAINING_TAFILA_APPROVED_RECONCILIATION', C.FIELD_TRAINING, 'مطابقة النتائج المعتمدة', 'Approved result reconciliation');
a('FIELD_TRAINING_SUPERVISOR_ASSIGNMENTS_IMPORTED', C.FIELD_TRAINING, 'استيراد المشرفين', 'Supervisor assignments imported');
a('FIELD_TRAINING_OPENED', C.FIELD_TRAINING, 'فتح التدريب الميداني', 'Field training opened');
a('RECORDED_LECTURE_CREATED', C.FIELD_TRAINING, 'إضافة محاضرة مسجلة', 'Recorded lecture created');
a('RECORDED_LECTURE_UPDATED', C.FIELD_TRAINING, 'تعديل محاضرة مسجلة', 'Recorded lecture updated');
a('RECORDED_LECTURE_FILE_REPLACED', C.FIELD_TRAINING, 'استبدال ملف محاضرة', 'Recorded lecture file replaced');
a('RECORDED_LECTURE_PUBLISHED', C.FIELD_TRAINING, 'نشر محاضرة مسجلة', 'Recorded lecture published');
a('RECORDED_LECTURE_UNPUBLISHED', C.FIELD_TRAINING, 'إلغاء نشر محاضرة', 'Recorded lecture unpublished');
a('RECORDED_LECTURE_HIDDEN', C.FIELD_TRAINING, 'إخفاء محاضرة مسجلة', 'Recorded lecture hidden');
a('RECORDED_LECTURE_IMPORTED_SINGLE', C.FIELD_TRAINING, 'استيراد محاضرة', 'Recorded lecture imported');
a('RECORDED_LECTURES_IMPORTED_PLAYLIST', C.FIELD_TRAINING, 'استيراد قائمة محاضرات', 'Playlist imported');
a('RECORDED_LECTURE_PLAYLIST_SYNCED', C.FIELD_TRAINING, 'مزامنة قائمة محاضرات', 'Playlist synced');
a('RECORDED_LECTURES_REORDERED', C.FIELD_TRAINING, 'إعادة ترتيب المحاضرات', 'Lectures reordered');
a('RECORDED_LECTURE_OPENED', C.FIELD_TRAINING, 'فتح محاضرة مسجلة', 'Recorded lecture opened');
a('RECORDED_LECTURE_STARTED', C.FIELD_TRAINING, 'بدء مشاهدة محاضرة', 'Recorded lecture started');
a('RECORDED_LECTURE_COMPLETED', C.FIELD_TRAINING, 'إكمال محاضرة مسجلة', 'Recorded lecture completed');
a('FIELD_TRAINING_STUDENT_REPORTS_BULK_EXPORTED', C.REPORT, 'تصدير تقارير الطلاب (ZIP)', 'Student reports bulk export');

// ── ATTENDANCE ─────────────────────────────────────────────────────────────
a('FIELD_TRAINING_ATTENDANCE_WINDOW_OPENED', C.ATTENDANCE, 'فتح نافذة الحضور', 'Attendance window opened');
a('FIELD_TRAINING_ATTENDANCE_WINDOW_CLOSED', C.ATTENDANCE, 'إغلاق نافذة الحضور', 'Attendance window closed');
a('FIELD_TRAINING_ATTENDANCE_ELECTRONIC_CONFIRM', C.ATTENDANCE, 'تأكيد حضور إلكتروني', 'Attendance confirmed');
a('FIELD_TRAINING_ATTENDANCE_FINALIZED_ABSENT', C.ATTENDANCE, 'تسجيل غياب', 'Marked absent');
a('FIELD_TRAINING_ATTENDANCE_MANUAL_UPDATE', C.ATTENDANCE, 'تعديل حضور يدوي', 'Attendance updated manually');
a('FIELD_TRAINING_ATTENDANCE_MARK_ALL_PRESENT', C.ATTENDANCE, 'تحضير جماعي', 'Mark all present');
a(
  'ATTENDANCE_MARKED_PRESENT_FROM_RECORDED_LECTURE',
  C.ATTENDANCE,
  'تم تحويل حضور الطالب إلى "حاضر" تلقائيًا بعد إكمال المحاضرة المسجلة',
  'Attendance marked present after recorded lecture completion'
);
a('TRAINING_ATTENDANCE_SET', C.ATTENDANCE, 'تسجيل حضور', 'Attendance set');
a('TRAINING_MARK_ALL_PRESENT', C.ATTENDANCE, 'تحضير جماعي', 'Mark all present');

// ── ASSESSMENT ─────────────────────────────────────────────────────────────
a('FIELD_TRAINING_ASSESSMENT_PUBLISHED', C.ASSESSMENT, 'نشر اختبار', 'Assessment published');
a('FIELD_TRAINING_ASSESSMENT_UPDATED', C.ASSESSMENT, 'تعديل اختبار', 'Assessment updated');
a('FIELD_TRAINING_ASSESSMENT_SUBMITTED', C.ASSESSMENT, 'تسليم اختبار', 'Assessment submitted');
a('TRAINING_ASSESSMENT_CREATED', C.ASSESSMENT, 'إنشاء اختبار', 'Assessment created');
a('TRAINING_ASSESSMENT_UPDATED', C.ASSESSMENT, 'تعديل اختبار', 'Assessment updated');
a('TRAINING_ASSESSMENT_PUBLISHED', C.ASSESSMENT, 'نشر اختبار', 'Assessment published');
a('TRAINING_ASSESSMENT_SUBMITTED', C.ASSESSMENT, 'تسليم اختبار', 'Assessment submitted');
a('training_assessment.create', C.ASSESSMENT, 'إنشاء اختبار', 'Assessment created', { legacy: true });
a('training_assessment.update', C.ASSESSMENT, 'تعديل اختبار', 'Assessment updated', { legacy: true });
a('training_assessment.publish', C.ASSESSMENT, 'نشر اختبار', 'Assessment published', { legacy: true });

// ── EVALUATION ─────────────────────────────────────────────────────────────
a('FT_EVAL_TEMPLATE_UPLOADED', C.EVALUATION, 'رفع نموذج تقييم', 'Evaluation template uploaded');
a('FT_EVAL_TEMPLATE_REPLACED', C.EVALUATION, 'استبدال نموذج تقييم', 'Evaluation template replaced');
a('FT_EVAL_TEMPLATE_DEFAULT_CHANGED', C.EVALUATION, 'تغيير نموذج التقييم الافتراضي', 'Default template changed');
a('FT_EVAL_OPPORTUNITY_OVERRIDE_CHANGED', C.EVALUATION, 'تخصيص نموذج تقييم للفرصة', 'Opportunity template override');
a('FT_EVAL_POLICY_CHANGED', C.EVALUATION, 'تعديل سياسة التقييم', 'Evaluation policy changed');
a('FT_EVAL_MANUAL_RATING_SAVED', C.EVALUATION, 'حفظ تقييم المشرف', 'Supervisor rating saved');
a('FT_EVAL_BULK_ELIGIBLE_RATING_SAVED', C.EVALUATION, 'تقييم جماعي (طالب)', 'Bulk rating (student row)');
a('FT_EVAL_BULK_ELIGIBLE_RATING_APPLIED', C.EVALUATION, 'تطبيق تقييم جماعي', 'Bulk rating applied');
a('FT_EVAL_REPORT_GENERATED', C.EVALUATION, 'إصدار تقرير التقييم النهائي', 'Final evaluation generated');
a('FT_EVAL_REPORT_REGENERATED', C.EVALUATION, 'إعادة إصدار تقرير التقييم', 'Final evaluation regenerated');
a('FT_EVAL_ACADEMIC_SUPERVISOR_SYNC', C.EVALUATION, 'مزامنة المشرفين الأكاديميين', 'Academic supervisors synced');
a('FINAL_EVALUATION_REOPENED', C.EVALUATION, 'إعادة فتح التقييم النهائي', 'Final evaluation reopened');
a('training_evaluation_template.seed', C.EVALUATION, 'تهيئة نموذج تقييم', 'Evaluation template seeded', {
  legacy: true,
});

// ── FILE ───────────────────────────────────────────────────────────────────
a('FILE_UPLOADED', C.FILE, 'رفع ملف', 'File uploaded');
a('FILE_DELETED', C.FILE, 'حذف ملف', 'File deleted');
a('FILE_DOWNLOADED', C.FILE, 'تنزيل ملف', 'File downloaded');
a('FT_EVAL_BULK_ZIP_DOWNLOADED', C.FILE, 'تنزيل تقارير التقييم (ZIP)', 'Evaluation reports ZIP downloaded');
a('FT_EVAL_SUPERVISOR_ZIP_DOWNLOADED', C.FILE, 'تنزيل تقارير مشرف (ZIP)', 'Supervisor reports ZIP downloaded');
a('FT_EVAL_ALL_SUPERVISOR_ZIP_DOWNLOADED', C.FILE, 'تنزيل تقارير المشرفين (ZIP)', 'All supervisor reports ZIP downloaded');

// ── REPORT ─────────────────────────────────────────────────────────────────
a('report.read', C.REPORT, 'عرض تقرير', 'Report viewed');
a('report.export', C.REPORT, 'تصدير تقرير', 'Report exported');
a('report.generate', C.REPORT, 'إنشاء تقرير', 'Report generated');
a('REPORT_OPENED', C.REPORT, 'فتح تقرير', 'Report opened');
a('FT_EXCEL_EVALUATION_EXPORTED', C.REPORT, 'تصدير كشف التقييم (Excel)', 'Excel evaluation exported');
a('STUDENT_REPORT_DOWNLOADED', C.REPORT, 'تنزيل تقرير طالب', 'Student report downloaded');

// ── CERTIFICATE / COMPLETION LETTER / MICRO-CREDENTIAL ─────────────────────
a('TRAINING_CERTIFICATE_ISSUED', C.CERTIFICATE, 'إصدار شهادة', 'Certificate issued');
a('TRAINING_CERTIFICATE_REGENERATED', C.CERTIFICATE, 'إعادة إصدار شهادة', 'Certificate regenerated');
a('TRAINING_CERTIFICATE_REVOKED', C.CERTIFICATE, 'إلغاء شهادة', 'Certificate revoked');
a('TRAINING_CERTIFICATE_DOWNLOADED', C.CERTIFICATE, 'تنزيل شهادة', 'Certificate downloaded');
a('FIELD_TRAINING_COMPLETION_LETTER_ISSUED', C.COMPLETION_LETTER, 'إصدار كتاب إنجاز', 'Completion letter issued');
a('FIELD_TRAINING_COMPLETION_LETTER_REGENERATED', C.COMPLETION_LETTER, 'إعادة إصدار كتاب إنجاز', 'Completion letter regenerated');
a('FIELD_TRAINING_COMPLETION_LETTER_REVOKED', C.COMPLETION_LETTER, 'إلغاء كتاب إنجاز', 'Completion letter revoked');
a('FIELD_TRAINING_COMPLETION_LETTER_DOWNLOADED', C.COMPLETION_LETTER, 'تنزيل كتاب إنجاز', 'Completion letter downloaded');
a('FIELD_TRAINING_COMPLETION_LETTERS_ZIP_DOWNLOADED', C.COMPLETION_LETTER, 'تنزيل كتب الإنجاز (ZIP)', 'Completion letters ZIP downloaded');
a('certificate.issue', C.MICRO_CREDENTIAL, 'إصدار شهادة مصغّرة', 'Micro-credential issued');
a('certificate.status', C.MICRO_CREDENTIAL, 'تغيير حالة شهادة مصغّرة', 'Micro-credential status changed');
a('MICRO_CREDENTIAL_DOWNLOADED', C.MICRO_CREDENTIAL, 'تنزيل شهادة مصغّرة', 'Micro-credential downloaded');
a('recognition_request.status', C.MICRO_CREDENTIAL, 'تغيير حالة طلب اعتراف', 'Recognition request status');
a('integrity_case.reported', C.SECURITY, 'الإبلاغ عن حالة نزاهة', 'Integrity case reported');

// ── NOTIFICATION / CONTENT ─────────────────────────────────────────────────
a('NOTIFICATION_RULE_CREATED', C.NOTIFICATION, 'إنشاء قاعدة إشعار', 'Notification rule created');
a('NOTIFICATION_RULE_UPDATED', C.NOTIFICATION, 'تعديل قاعدة إشعار', 'Notification rule updated');
a('NOTIFICATION_RULE_DRAFT', C.NOTIFICATION, 'قاعدة إشعار كمسودة', 'Notification rule set to draft');
a('NOTIFICATION_RULE_ACTIVE', C.NOTIFICATION, 'تفعيل قاعدة إشعار', 'Notification rule activated');
a('NOTIFICATION_RULE_PAUSED', C.NOTIFICATION, 'إيقاف قاعدة إشعار', 'Notification rule paused');
a('NOTIFICATION_RULE_ARCHIVED', C.NOTIFICATION, 'أرشفة قاعدة إشعار', 'Notification rule archived');
a('NOTIFICATION_TEMPLATE_CREATED', C.NOTIFICATION, 'إنشاء قالب إشعار', 'Notification template created');
a('NOTIFICATION_DELIVERY_RETRY', C.NOTIFICATION, 'إعادة إرسال إشعار', 'Notification delivery retried');
a('NOTIFICATION_MANUAL_SEND', C.NOTIFICATION, 'إرسال إشعار يدوي', 'Manual notification sent');
a('announcement.create', C.NOTIFICATION, 'إنشاء إعلان', 'Announcement created');
a('announcement.update', C.NOTIFICATION, 'تعديل إعلان', 'Announcement updated');
a('announcement.update_audience', C.NOTIFICATION, 'تعديل جمهور إعلان', 'Announcement audience updated');
a('announcement.publish', C.NOTIFICATION, 'نشر إعلان', 'Announcement published');
a('announcement.schedule', C.NOTIFICATION, 'جدولة إعلان', 'Announcement scheduled');
a('announcement.pause', C.NOTIFICATION, 'إيقاف إعلان', 'Announcement paused');
a('announcement.archive', C.NOTIFICATION, 'أرشفة إعلان', 'Announcement archived');
a('announcement.duplicate', C.NOTIFICATION, 'نسخ إعلان', 'Announcement duplicated');
a('popup_created', C.NOTIFICATION, 'إنشاء نافذة منبثقة', 'Popup created');
a('popup_updated', C.NOTIFICATION, 'تعديل نافذة منبثقة', 'Popup updated');
a('popup_published', C.NOTIFICATION, 'نشر نافذة منبثقة', 'Popup published');
a('popup_paused', C.NOTIFICATION, 'إيقاف نافذة منبثقة', 'Popup paused');
a('popup_archived', C.NOTIFICATION, 'أرشفة نافذة منبثقة', 'Popup archived');
a('HELP_CATEGORY_CREATED', C.NOTIFICATION, 'إنشاء تصنيف مساعدة', 'Help category created');
a('HELP_CATEGORY_UPDATED', C.NOTIFICATION, 'تعديل تصنيف مساعدة', 'Help category updated');
a('HELP_CATEGORY_ARCHIVED', C.NOTIFICATION, 'أرشفة تصنيف مساعدة', 'Help category archived');
a('HELP_ARTICLE_CREATED', C.NOTIFICATION, 'إنشاء مقال مساعدة', 'Help article created');
a('HELP_ARTICLE_UPDATED', C.NOTIFICATION, 'تعديل مقال مساعدة', 'Help article updated');
a('HELP_ARTICLE_PUBLISHED', C.NOTIFICATION, 'نشر مقال مساعدة', 'Help article published');
a('HELP_ARTICLE_UNPUBLISHED', C.NOTIFICATION, 'إلغاء نشر مقال مساعدة', 'Help article unpublished');
a('HELP_ARTICLE_ARCHIVED', C.NOTIFICATION, 'أرشفة مقال مساعدة', 'Help article archived');
a('HELP_ARTICLE_VERSION_RESTORED', C.NOTIFICATION, 'استعادة نسخة مقال', 'Help article version restored');
a('HELP_ARTICLES_REORDERED', C.NOTIFICATION, 'إعادة ترتيب مقالات المساعدة', 'Help articles reordered');
a('USER_GUIDE_CREATED', C.NOTIFICATION, 'إنشاء دليل استخدام', 'User guide created');
a('USER_GUIDE_UPDATED', C.NOTIFICATION, 'تعديل دليل استخدام', 'User guide updated');
a('USER_GUIDE_PUBLISHED', C.NOTIFICATION, 'نشر دليل استخدام', 'User guide published');
a('USER_GUIDE_ARCHIVED', C.NOTIFICATION, 'أرشفة دليل استخدام', 'User guide archived');

// ── SYSTEM (historical script operations) ──────────────────────────────────
a('BULK_USERS_VERIFIED_AND_ACTIVATED', C.SYSTEM, 'تفعيل وتوثيق جماعي (نظام)', 'Bulk verify + activate', { legacy: true });
a('FIELD_TRAINING_ACADEMIC_SUPERVISOR_NAME_UPDATED', C.SYSTEM, 'تحديث اسم مشرف أكاديمي', 'Academic supervisor name updated', {
  legacy: true,
});
a('TAFILA_TASKS_POST_ELIGIBLE_AND_ISSUE_LETTERS_V1', C.SYSTEM, 'معالجة نظام (كتب إنجاز)', 'System operation', { legacy: true });
a('TAFILA_POST_COMPLETE_ELIGIBLE_140H_ISSUE_LETTERS_V1', C.SYSTEM, 'معالجة نظام (كتب إنجاز)', 'System operation', { legacy: true });
a('FIELD_TRAINING_MARK_STUDENT_PRESENT_ALL_SESSIONS_V1', C.SYSTEM, 'معالجة نظام (حضور)', 'System operation', { legacy: true });
a('FIELD_TRAINING_MUTAH_POST_COMPLETE_LETTER_ELIGIBLE_V1', C.SYSTEM, 'معالجة نظام (أهلية)', 'System operation', { legacy: true });
a('FIELD_TRAINING_UNIFY_TAFILA_TEMPLATE_CONVERT_ELIGIBLE_V1', C.SYSTEM, 'معالجة نظام (نماذج)', 'System operation', { legacy: true });

const AUDIT_ACTIONS = Object.freeze(registry);

/** Navigation "opened" events accepted from the client (deduplicated server-side). */
const NAVIGATION_ACTIONS = Object.freeze({
  COURSE: 'COURSE_OPENED',
  ASSIGNMENT: 'ASSIGNMENT_OPENED',
  FIELD_TRAINING: 'FIELD_TRAINING_OPENED',
  REPORT: 'REPORT_OPENED',
  RECORDED_LECTURE: 'RECORDED_LECTURE_OPENED',
});

/** Session end reasons (auth_sessions.end_reason). */
const SESSION_END_REASONS = Object.freeze({
  USER_LOGOUT: 'USER_LOGOUT',
  IDLE_TIMEOUT: 'IDLE_TIMEOUT',
  ABSOLUTE_EXPIRY: 'ABSOLUTE_EXPIRY',
  ADMIN_REVOKED: 'ADMIN_REVOKED',
  PASSWORD_RESET: 'PASSWORD_RESET',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  /** Account status changed / account deletion / generic security revocation. */
  SECURITY_REVOKED: 'SECURITY_REVOKED',
  /** Platform or organization role (incl. global access) changed. */
  ROLE_CHANGED: 'ROLE_CHANGED',
  /** University / organization scope changed. */
  SCOPE_CHANGED: 'SCOPE_CHANGED',
  /** MFA factor reset by an administrator. */
  MFA_RESET: 'MFA_RESET',
  /** The user ended one of their own other sessions. */
  USER_REVOKED: 'USER_REVOKED',
  /** The user ended all their other sessions. */
  USER_REVOKED_OTHER_SESSIONS: 'USER_REVOKED_OTHER_SESSIONS',
});

function getAuditActionMeta(action) {
  if (!action || typeof action !== 'string') return null;
  return AUDIT_ACTIONS[action] || null;
}

function isRegisteredAuditAction(action) {
  return Boolean(getAuditActionMeta(action));
}

function categoryForAction(action) {
  return getAuditActionMeta(action)?.category || null;
}

function actionLabel(action, locale = 'ar') {
  const meta = getAuditActionMeta(action);
  if (!meta) return null;
  return locale === 'en' ? meta.labelEn : meta.labelAr;
}

function categoryLabel(category, locale = 'ar') {
  const meta = CATEGORY_LABELS[category];
  if (!meta) return null;
  return locale === 'en' ? meta.en : meta.ar;
}

function outcomeLabel(outcome, locale = 'ar') {
  const meta = OUTCOME_LABELS[outcome];
  if (!meta) return null;
  return locale === 'en' ? meta.en : meta.ar;
}

function listActionsForCategory(category) {
  return Object.entries(AUDIT_ACTIONS)
    .filter(([, meta]) => meta.category === category)
    .map(([action]) => action);
}

/** Actions registered under a security category (matches rows written before the column existed). */
function listActionsForSecurityCategory(securityCategory) {
  return Object.entries(AUDIT_ACTIONS)
    .filter(([, meta]) => meta.security?.category === securityCategory)
    .map(([action]) => action);
}

function securityMetaForAction(action) {
  return getAuditActionMeta(action)?.security || null;
}

function securityCategoryLabel(code, locale = 'ar') {
  const meta = SECURITY_CATEGORY_LABELS[code];
  if (!meta) return null;
  return locale === 'en' ? meta.en : meta.ar;
}

function severityLabel(code, locale = 'ar') {
  const meta = SEVERITY_LABELS[code];
  if (!meta) return null;
  return locale === 'en' ? meta.en : meta.ar;
}

/** Catalog for the Logs page filters (labels resolved server-side). */
function buildAuditCatalog() {
  return {
    categories: Object.keys(AUDIT_CATEGORIES).map((code) => ({
      code,
      label_ar: CATEGORY_LABELS[code].ar,
      label_en: CATEGORY_LABELS[code].en,
    })),
    outcomes: Object.keys(AUDIT_OUTCOMES).map((code) => ({
      code,
      label_ar: OUTCOME_LABELS[code].ar,
      label_en: OUTCOME_LABELS[code].en,
    })),
    security_categories: Object.keys(SECURITY_CATEGORIES).map((code) => ({
      code,
      label_ar: SECURITY_CATEGORY_LABELS[code].ar,
      label_en: SECURITY_CATEGORY_LABELS[code].en,
    })),
    severities: Object.keys(SECURITY_SEVERITIES).map((code) => ({
      code,
      label_ar: SEVERITY_LABELS[code].ar,
      label_en: SEVERITY_LABELS[code].en,
    })),
    actions: Object.entries(AUDIT_ACTIONS).map(([code, meta]) => ({
      code,
      category: meta.category,
      security_category: meta.security?.category || null,
      label_ar: meta.labelAr,
      label_en: meta.labelEn,
      legacy: Boolean(meta.legacy),
    })),
  };
}

module.exports = {
  AUDIT_CATEGORIES,
  AUDIT_OUTCOMES,
  AUDIT_ACTIONS,
  CATEGORY_LABELS,
  OUTCOME_LABELS,
  NAVIGATION_ACTIONS,
  SESSION_END_REASONS,
  SECURITY_CRITICAL_CATEGORIES,
  SECURITY_CATEGORIES,
  SECURITY_CATEGORY_LABELS,
  SECURITY_SEVERITIES,
  SEVERITY_LABELS,
  getAuditActionMeta,
  isRegisteredAuditAction,
  categoryForAction,
  actionLabel,
  categoryLabel,
  outcomeLabel,
  securityCategoryLabel,
  severityLabel,
  securityMetaForAction,
  listActionsForCategory,
  listActionsForSecurityCategory,
  buildAuditCatalog,
};

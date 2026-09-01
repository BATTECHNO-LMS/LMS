/**
 * Unwrap BATTECHNO-LMS API envelope: `{ success, message?, data }`.
 * @param {import('axios').AxiosResponse} res
 * @returns {unknown}
 */
export function unwrapApiData(res) {
  const body = res?.data;
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid API response');
  }
  if (body.success === false) {
    const msg = typeof body.message === 'string' ? body.message : 'تعذر إكمال العملية.';
    const err = new Error(msg);
    err.code = body.code || 'API_ERROR';
    err.status = res.status;
    err.details = body.details ?? null;
    err.requestId = body.requestId ?? null;
    throw err;
  }
  return body.data;
}

const TRAINING_ERROR_AR = {
  PORTAL_MISMATCH: 'هذا الحساب لا ينتمي إلى بوابة الدخول المحددة.',
  ROLE_NOT_ALLOWED: 'ليس لديك صلاحية لتنفيذ هذا الإجراء.',
  ORGANIZATION_ASSIGNMENT_REQUIRED: 'يلزم ارتباط نشط بمؤسسة للوصول.',
  ORGANIZATION_SCOPE_VIOLATION: 'لا يمكنك الوصول إلى بيانات خارج نطاق مؤسستك.',
  TRAINING_PROGRAM_NOT_FOUND: 'الدورة التدريبية غير موجودة.',
  TRAINING_PROGRAM_NOT_AVAILABLE: 'الدورة التدريبية غير متاحة حاليًا.',
  TRAINER_ASSIGNMENT_REQUIRED: 'يلزم تعيينك كمدرب على هذه الدورة.',
  TRAINER_PERMISSION_REQUIRED: 'لا تملك صلاحية المدرب المطلوبة لهذا الإجراء.',
  COURSE_ENROLLMENT_REQUIRED: 'يلزم التسجيل في الدورة للوصول إلى هذا المحتوى.',
  ENROLLMENT_PENDING: 'تسجيلك بانتظار الموافقة.',
  ENROLLMENT_REJECTED: 'تم رفض طلب التسجيل.',
  ATTENDANCE_WINDOW_OPEN: 'توجد نافذة حضور مفتوحة لهذه الجلسة بالفعل. أغلقها أو انتظر انتهاء المدة.',
  ATTENDANCE_WINDOW_CLOSED: 'لا توجد نافذة حضور مفتوحة.',
  ATTENDANCE_CODE_INVALID: 'رمز الحضور غير صحيح.',
  ATTENDANCE_CODE_EXPIRED: 'انتهت صلاحية رمز الحضور.',
  TASK_NOT_AVAILABLE: 'المهمة غير متاحة حاليًا.',
  ASSESSMENT_NOT_AVAILABLE: 'الاختبار غير متاح حاليًا.',
  ASSESSMENT_NOT_FOUND: 'الاختبار غير موجود.',
  ASSESSMENT_NOT_PUBLISHED: 'الاختبار غير منشور.',
  ASSESSMENT_NOT_STARTED: 'لم يبدأ الاختبار بعد.',
  ASSESSMENT_CLOSED: 'انتهت فترة إتاحة الاختبار.',
  ASSESSMENT_PREREQUISITES_INCOMPLETE:
    'الاختبار البعدي غير متاح حاليًا. أكمل متطلبات الدورة المطلوبة أولًا.',
  ASSESSMENT_ATTEMPTS_EXHAUSTED: 'أكملت جميع المحاولات المتاحة.',
  ASSESSMENT_ATTEMPT_ALREADY_SUBMITTED: 'تم إرسال هذه المحاولة مسبقًا.',
  ASSESSMENT_ATTEMPT_EXPIRED: 'انتهت مدة المحاولة.',
  ASSESSMENT_MANUAL_GRADING_PENDING: 'نتيجتك بانتظار مراجعة المدرب.',
  COURSE_REQUIREMENTS_INCOMPLETE: 'متطلبات الدورة غير مكتملة بعد.',
  CERTIFICATE_NOT_ELIGIBLE: 'الشهادة غير متاحة لهذا التسجيل.',
  FINAL_EVALUATION_LOCKED: 'يصبح التقييم النهائي متاحًا بعد استكمال الاختبار البعدي.',
  FINAL_EVALUATION_NOT_AVAILABLE: 'التقييم النهائي غير متاح حاليًا لهذه الدورة.',
  FINAL_EVALUATION_ALREADY_SUBMITTED: 'تم إرسال التقييم النهائي بالفعل ولا يمكن تعديله.',
  FINAL_EVALUATION_VALIDATION_FAILED: 'يرجى الإجابة على جميع الأسئلة المطلوبة قبل إرسال التقييم.',
  FILE_REQUIRED: 'يرجى رفع ملف DOCX.',
  INVALID_TEMPLATE_FILE: 'صيغة القالب غير صالحة. يُقبل DOCX فقط.',
  TEMPLATE_VALIDATION_FAILED: 'القالب ناقص الحقول المطلوبة ولم يُفعَّل.',
  FIELD_TRAINING_EVALUATION_TEMPLATE_MISSING: 'لا يوجد قالب تقييم معتمد لهذه الجامعة/الفرصة.',
  UNIVERSITY_REQUIRED: 'يرجى تحديد الجامعة أو ربط الفرصة بجامعة.',
  UPLOAD_FAILED: 'تعذّر رفع الملف. حاول مرة أخرى.',
  POST_TEST_GRADING_PENDING: 'نتيجة الاختبار البعدي بانتظار مراجعة المدرب.',
  TRAINING_REQUIREMENTS_INCOMPLETE: 'متطلبات إنهاء الدورة غير مكتملة بعد لهذا المتدرب.',
  TRAINING_NOT_READY_TO_CLOSE: 'لا يوجد متدربون مؤهلون لإنهاء الدورة حاليًا وفق المعايير المحددة.',
  TRAINING_ALREADY_FINALIZED: 'تم إنهاء هذا التسجيل مسبقًا.',
  TRAINING_FINALIZATION_FORBIDDEN: 'لا تملك صلاحية إنهاء التدريب لهذه الدورة.',
  EXCEPTIONAL_FINALIZATION_REASON_REQUIRED: 'يجب إدخال سبب واضح للإنهاء الاستثنائي.',
  REPORT_NOT_READY: 'التقرير غير جاهز بعد. حاول توليده أولًا.',
  // Actual backend codes for the same flows (kept alongside the names above for full coverage).
  FINALIZATION_MODE_INVALID: 'وضع الإنهاء غير صالح.',
  FINALIZATION_REASON_REQUIRED: 'يجب إدخال سبب للإنهاء الاستثنائي.',
  NO_ELIGIBLE_ENROLLMENTS: 'لا يوجد متدربون مؤهلون للإنهاء وفق المعايير المحددة.',
  NO_COMPLETED_ENROLLMENTS: 'لا يوجد متدربون مكتملون لإعادة فتحهم.',
  INDIVIDUAL_REPORT_NOT_FOUND: 'لا يوجد تقرير فردي لهذا المتدرب بعد.',
  COURSE_REPORT_NOT_FOUND: 'لا يوجد تقرير للدورة بعد.',
  ENROLLMENT_NOT_FOUND: 'التسجيل غير موجود.',
  PDF_RENDER_FAILED: 'تعذر إنشاء كتاب الإنهاء. حاول مرة أخرى بعد قليل.',
  PDF_RENDER_UNAVAILABLE: 'تعذر إنشاء ملف PDF على الخادم حالياً.',
  FIELD_TRAINING_TEMPLATE_RENDER_FAILED:
    'تعذر إنشاء التقرير من قالب الجامعة الرسمي. لم يتم إنشاء تقرير بديل.',
  TEMPLATE_FIDELITY_FAIL:
    'تعذر إنشاء التقرير من قالب الجامعة الرسمي. لم يتم إنشاء تقرير بديل.',
  REPORT_READ_ONLY: 'ليس لديك صلاحية إنشاء أو إعادة إنشاء التقارير. يمكنك عرض وتنزيل التقارير المتاحة فقط.',
  REPORT_EXPORT_FAILED: 'تعذر تصدير التقرير. حاول مرة أخرى بعد قليل.',
  FIELD_TRAINING_STUDENTS_EXPORT_EMPTY: 'لا يوجد طلاب مطابقون للتصدير',
  BULK_ISSUE_IN_PROGRESS: 'يوجد إصدار جماعي قيد التنفيذ حالياً، يرجى الانتظار حتى اكتماله.',
  NO_READY_LETTERS: 'لا توجد كتب إنهاء جاهزة للتنزيل لهذه الفرصة.',
  NO_ELIGIBLE_STUDENTS: 'لا يوجد طلاب مؤهلون لإصدار كتب الإنهاء.',
  COMPLETION_LETTERS_NOT_ISSUED: 'لا توجد كتب إنهاء جاهزة للتنزيل. استخدم إصدار الكل أولاً.',
  TEMPLATE_RENDER_FAILED: 'تعذر إنشاء كتاب الإنهاء لبعض الطلاب.',
  OUTPUT_WRITE_FAILED: 'تعذر حفظ كتاب الإنهاء. حاول مرة أخرى.',
  UNAUTHORIZED: 'غير مصرح لك بتنفيذ هذه العملية.',
  FIELD_TRAINING_FORBIDDEN: 'غير مصرح لك بتنفيذ هذه العملية.',
};

/**
 * @param {unknown} err
 * @param {string} [fallback]
 */
export function isCanceledRequest(err) {
  return (
    err?.code === 'ERR_CANCELED' ||
    err?.name === 'CanceledError' ||
    err?.name === 'AbortError'
  );
}

export function getApiErrorMessage(err, fallback = 'Request failed') {
  if (isCanceledRequest(err)) {
    return fallback;
  }
  if (!err?.response) {
    if (err && typeof err === 'object' && err.code && TRAINING_ERROR_AR[err.code]) {
      return TRAINING_ERROR_AR[err.code];
    }
    if (err?.code === 'ECONNABORTED') {
      return 'انتهت مهلة الاتصال بالمنصة. حاول مرة أخرى.';
    }
    return 'تعذر الاتصال بالمنصة. تحقق من اتصال الإنترنت ثم حاول مرة أخرى.';
  }
  const body = err?.response?.data;
  if (body && typeof Blob !== 'undefined' && body instanceof Blob) {
    return fallback === 'Request failed' ? 'تعذر إكمال العملية. حاول مرة أخرى بعد قليل.' : fallback;
  }
  const code = body?.code || err?.code;
  if (code && TRAINING_ERROR_AR[code]) {
    return TRAINING_ERROR_AR[code];
  }
  if (body && typeof body === 'object' && typeof body.message === 'string' && body.message) {
    const fields = body.details?.fields;
    if (fields && typeof fields === 'object') {
      const firstKey = Object.keys(fields).find((k) => Array.isArray(fields[k]) && fields[k].length);
      if (firstKey) {
        const msg = fields[firstKey][0];
        if (typeof msg === 'string' && msg) return msg;
      }
    }
    return body.message;
  }
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    const msg = err.message || '';
    if (/axioserror|network error|econnrefused|internal server|forbidden|unauthorized|p20\d{2}/i.test(msg)) {
      return 'تعذر إكمال العملية. حاول مرة أخرى بعد قليل.';
    }
    return msg || fallback;
  }
  return fallback;
}

const { ApiError } = require('../../utils/apiError');

const MSG = {
  title: 'العنوان مطلوب (3 أحرف على الأقل)',
  organization_name: 'اسم الجهة مطلوب',
  description: 'الوصف الكامل مطلوب (10 أحرف على الأقل)',
  location: 'الموقع مطلوب',
  training_mode: 'نوع التدريب مطلوب',
  deadline_after_start: 'آخر موعد للتقديم لا يمكن أن يكون بعد تاريخ البداية',
  archived: 'لا يمكن نشر فرصة مؤرشفة',
};

/**
 * @param {{ status: string, title: string, organization_name: string, description: string | null, location: string, training_mode: string, application_deadline: Date | null, start_date: Date | null }} opportunity
 */
function collectPublishMissing(opportunity) {
  const missing = [];

  if (opportunity.status === 'archived') {
    missing.push(MSG.archived);
    return missing;
  }

  const title = String(opportunity.title || '').trim();
  if (title.length < 3) missing.push(MSG.title);

  if (!String(opportunity.organization_name || '').trim()) missing.push(MSG.organization_name);

  const desc = String(opportunity.description || '').trim();
  if (desc.length < 10) missing.push(MSG.description);

  if (!String(opportunity.location || '').trim()) missing.push(MSG.location);

  if (!opportunity.training_mode) missing.push(MSG.training_mode);

  if (opportunity.application_deadline && opportunity.start_date) {
    const deadline = new Date(opportunity.application_deadline);
    const start = new Date(opportunity.start_date);
    if (deadline > start) missing.push(MSG.deadline_after_start);
  }

  return [...new Set(missing)];
}

/**
 * @param {Parameters<typeof collectPublishMissing>[0]} opportunity
 */
function assertPublishReady(opportunity) {
  const missing = collectPublishMissing(opportunity);
  if (missing.length) {
    throw new ApiError(
      400,
      'فرصة التدريب غير جاهزة للنشر',
      { missing },
      'FIELD_TRAINING_PUBLISH_READINESS'
    );
  }
}

module.exports = { collectPublishMissing, assertPublishReady, MSG };

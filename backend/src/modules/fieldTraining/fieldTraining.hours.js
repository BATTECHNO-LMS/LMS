/**
 * Authoritative field-training hours helpers.
 *
 * Model A — aggregate on field_training_applications.completed_training_hours.
 * Write semantics: REPLACE total completed hours (not incremental add).
 * Required hours: field_training_opportunities.required_training_hours (nullable).
 * Completion eligibility does NOT currently gate on hours (attendance / assessments / task).
 */

function toNullableInt(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

/**
 * @param {{ completed_training_hours?: unknown, hours_updated_at?: unknown }} app
 * @param {{ required_training_hours?: unknown }} opp
 */
function buildHoursSummary(app = {}, opp = {}) {
  const required = toNullableInt(opp.required_training_hours);
  const completed = toNullableInt(app.completed_training_hours);
  const remaining =
    required != null && completed != null ? Math.max(0, required - completed) : null;
  const hoursProgressPercentage =
    required != null && required > 0 && completed != null
      ? Math.min(100, Math.round((completed / required) * 100))
      : null;

  return {
    required_training_hours: required,
    completed_training_hours: completed,
    remaining_training_hours: remaining,
    hours_progress_percentage: hoursProgressPercentage,
    hours_updated_at: app.hours_updated_at ?? null,
    hours_configured: required != null,
    hours_recorded: completed != null,
  };
}

/**
 * Validate a replacement completed-hours value against opportunity required hours.
 * @returns {{ ok: true, value: number } | { ok: false, status: number, message: string, code: string }}
 */
function validateCompletedHoursReplacement(completedHours, requiredHours) {
  if (completedHours == null || completedHours === '') {
    return {
      ok: false,
      status: 422,
      message: 'يجب إدخال عدد ساعات مكتملة صالح.',
      code: 'HOURS_REQUIRED',
    };
  }
  const value = Number(completedHours);
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    return {
      ok: false,
      status: 422,
      message: 'ساعات التدريب المكتملة يجب أن تكون عدداً صحيحاً.',
      code: 'HOURS_INVALID_PRECISION',
    };
  }
  if (value < 0) {
    return {
      ok: false,
      status: 422,
      message: 'لا يمكن أن تكون الساعات المكتملة سالبة.',
      code: 'HOURS_NEGATIVE',
    };
  }
  if (value > 10000) {
    return {
      ok: false,
      status: 422,
      message: 'قيمة الساعات المكتملة تتجاوز الحد المسموح.',
      code: 'HOURS_TOO_LARGE',
    };
  }
  const required = toNullableInt(requiredHours);
  if (required != null && value > required) {
    return {
      ok: false,
      status: 422,
      message: `لا يمكن أن تتجاوز الساعات المكتملة الساعات المطلوبة (${required}).`,
      code: 'HOURS_EXCEED_REQUIRED',
    };
  }
  return { ok: true, value };
}

/**
 * Validate required-hours value for opportunity create/update.
 * null clears the target; positive integers only when provided.
 */
function validateRequiredHoursValue(requiredHours) {
  if (requiredHours === undefined) {
    return { ok: true, skipped: true };
  }
  if (requiredHours === null || requiredHours === '') {
    return { ok: true, value: null };
  }
  const value = Number(requiredHours);
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    return {
      ok: false,
      status: 422,
      message: 'ساعات التدريب المطلوبة يجب أن تكون عدداً صحيحاً.',
      code: 'REQUIRED_HOURS_INVALID',
    };
  }
  if (value <= 0) {
    return {
      ok: false,
      status: 422,
      message: 'ساعات التدريب المطلوبة يجب أن تكون أكبر من صفر عند تحديدها.',
      code: 'REQUIRED_HOURS_NOT_POSITIVE',
    };
  }
  if (value > 10000) {
    return {
      ok: false,
      status: 422,
      message: 'ساعات التدريب المطلوبة تتجاوز الحد المسموح.',
      code: 'REQUIRED_HOURS_TOO_LARGE',
    };
  }
  return { ok: true, value };
}

module.exports = {
  buildHoursSummary,
  validateCompletedHoursReplacement,
  validateRequiredHoursValue,
  toNullableInt,
};

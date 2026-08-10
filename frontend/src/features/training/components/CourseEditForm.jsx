import { useEffect, useMemo, useState } from 'react';
import { FormInput } from '../../../components/forms/FormInput.jsx';
import { FormSelect } from '../../../components/forms/FormSelect.jsx';
import { FormTextarea } from '../../../components/forms/FormTextarea.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { updateProgram } from '../training.service.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';

function toDateInput(value) {
  if (!value) return '';
  try {
    return String(value).slice(0, 10);
  } catch {
    return '';
  }
}

function buildForm(course) {
  const domains = Array.isArray(course?.domains)
    ? course.domains.join('، ')
    : course?.field || '';
  return {
    title: course?.title || '',
    title_en: course?.titleEn || '',
    description: course?.description || '',
    short_description: course?.shortDescription || '',
    domains,
    field: course?.field || '',
    level: course?.level || '',
    language: course?.language || 'ar',
    delivery_mode: course?.deliveryMode || '',
    target_audience: course?.targetAudience || '',
    prerequisites: course?.prerequisites || '',
    objectives: course?.objectives || '',
    outcomes: course?.outcomes || '',
    start_date: toDateInput(course?.startDate),
    end_date: toDateInput(course?.endDate),
    registration_open_at: toDateInput(course?.registrationOpenAt),
    registration_close_at: toDateInput(course?.registrationCloseAt),
    venue: course?.venue || '',
    meeting_url: course?.meetingUrl || '',
    required_hours: course?.requiredHours != null ? String(course.requiredHours) : '',
    expected_sessions: course?.expectedSessions != null ? String(course.expectedSessions) : '',
    max_participants: course?.maxParticipants != null ? String(course.maxParticipants) : '',
    required_attendance_pct:
      course?.requiredAttendancePct != null ? String(course.requiredAttendancePct) : '',
    requires_pre_test: Boolean(course?.requiresPreTest),
    requires_post_test: Boolean(course?.requiresPostTest),
    requires_tasks: course?.requiresTasks !== false,
    requires_final_task: Boolean(course?.requiresFinalTask),
    requires_evaluation: Boolean(course?.requiresEvaluation),
    enrollment_open: course?.enrollmentOpen !== false,
    visibility: course?.visibilitySetting || 'ENROLLED',
    status: course?.status || 'DRAFT',
    timezone: course?.timezone || 'Asia/Amman',
  };
}

/**
 * Shared institutional course editor for Admin and assigned Trainer.
 * @param {{ course: object, programId: string, allowStatus?: boolean, onSaved?: (course: object) => void, onCancel?: () => void }} props
 */
export function CourseEditForm({ course, programId, allowStatus = true, onSaved, onCancel }) {
  const [form, setForm] = useState(() => buildForm(course));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setForm(buildForm(course));
    setDirty(false);
  }, [course]);

  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const setField = (key, value) => {
    setDirty(true);
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const payload = useMemo(() => {
    const body = {
      title: form.title.trim(),
      title_en: form.title_en.trim() || null,
      description: form.description || null,
      short_description: form.short_description || null,
      domains: form.domains
        .split(/[،,]/)
        .map((d) => d.trim())
        .filter(Boolean),
      field: form.field.trim() || form.domains.trim() || null,
      level: form.level || null,
      language: form.language || null,
      delivery_mode: form.delivery_mode || null,
      target_audience: form.target_audience || null,
      prerequisites: form.prerequisites || null,
      objectives: form.objectives || null,
      outcomes: form.outcomes || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      registration_open_at: form.registration_open_at || null,
      registration_close_at: form.registration_close_at || null,
      venue: form.venue || null,
      meeting_url: form.meeting_url || null,
      required_hours: form.required_hours !== '' ? Number(form.required_hours) : null,
      expected_sessions: form.expected_sessions !== '' ? Number(form.expected_sessions) : null,
      max_participants: form.max_participants !== '' ? Number(form.max_participants) : null,
      required_attendance_pct:
        form.required_attendance_pct !== '' ? Number(form.required_attendance_pct) : null,
      requires_pre_test: form.requires_pre_test,
      requires_post_test: form.requires_post_test,
      requires_tasks: form.requires_tasks,
      requires_final_task: form.requires_final_task,
      requires_evaluation: form.requires_evaluation,
      enrollment_open: form.enrollment_open,
      visibility: form.visibility || null,
      timezone: form.timezone || null,
    };
    if (allowStatus) body.status = form.status;
    return body;
  }, [form, allowStatus]);

  async function onSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('عنوان الدورة مطلوب.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const updated = await updateProgram(programId, payload);
      setDirty(false);
      setMessage('تم حفظ التعديلات بنجاح.');
      onSaved?.(updated);
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذر حفظ التعديلات.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="crud-form course-edit-form course-content-fade" onSubmit={onSubmit} dir="rtl">
      {error ? (
        <p className="form-field__error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="auth-register__helper course-save-success" role="status">
          {message}
        </p>
      ) : null}

      <SectionCard title="المعلومات الأساسية">
        <div className="auth-form__fields-grid">
          <FormInput
            id="ce-title"
            label="عنوان الدورة"
            required
            value={form.title}
            onChange={(e) => setField('title', e.target.value)}
            className="auth-form__span-full"
          />
          <FormInput
            id="ce-title-en"
            label="العنوان بالإنجليزية"
            value={form.title_en}
            onChange={(e) => setField('title_en', e.target.value)}
            className="auth-form__span-full"
          />
          <FormTextarea
            id="ce-short"
            label="وصف مختصر"
            value={form.short_description}
            onChange={(e) => setField('short_description', e.target.value)}
            className="auth-form__span-full"
          />
          <FormTextarea
            id="ce-desc"
            label="الوصف"
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            className="auth-form__span-full"
          />
          <FormInput
            id="ce-domains"
            label="مجالات التدريب (مفصولة بفاصلة)"
            value={form.domains}
            onChange={(e) => setField('domains', e.target.value)}
            className="auth-form__span-full"
          />
          <FormInput
            id="ce-level"
            label="المستوى"
            value={form.level}
            onChange={(e) => setField('level', e.target.value)}
          />
          <FormSelect
            id="ce-lang"
            label="اللغة"
            value={form.language}
            onChange={(e) => setField('language', e.target.value)}
          >
            <option value="ar">العربية</option>
            <option value="en">English</option>
            <option value="both">ثنائي اللغة</option>
          </FormSelect>
          <FormTextarea
            id="ce-audience"
            label="الفئة المستهدفة"
            value={form.target_audience}
            onChange={(e) => setField('target_audience', e.target.value)}
            className="auth-form__span-full"
          />
          <FormTextarea
            id="ce-prereq"
            label="المتطلبات السابقة"
            value={form.prerequisites}
            onChange={(e) => setField('prerequisites', e.target.value)}
            className="auth-form__span-full"
          />
        </div>
      </SectionCard>

      <SectionCard title="تفاصيل التدريب">
        <div className="auth-form__fields-grid">
          <FormInput
            id="ce-start"
            label="تاريخ البداية"
            type="date"
            value={form.start_date}
            onChange={(e) => setField('start_date', e.target.value)}
          />
          <FormInput
            id="ce-end"
            label="تاريخ النهاية"
            type="date"
            value={form.end_date}
            onChange={(e) => setField('end_date', e.target.value)}
          />
          <FormInput
            id="ce-reg-open"
            label="بداية التسجيل"
            type="date"
            value={form.registration_open_at}
            onChange={(e) => setField('registration_open_at', e.target.value)}
          />
          <FormInput
            id="ce-reg-close"
            label="نهاية التسجيل"
            type="date"
            value={form.registration_close_at}
            onChange={(e) => setField('registration_close_at', e.target.value)}
          />
          <FormSelect
            id="ce-delivery"
            label="نمط التقديم"
            value={form.delivery_mode}
            onChange={(e) => setField('delivery_mode', e.target.value)}
          >
            <option value="">—</option>
            <option value="in_person">حضوري</option>
            <option value="online">أونلاين</option>
            <option value="hybrid">هجين</option>
          </FormSelect>
          <FormInput
            id="ce-venue"
            label="مكان التدريب"
            value={form.venue}
            onChange={(e) => setField('venue', e.target.value)}
          />
          <FormInput
            id="ce-meeting"
            label="معلومات الاجتماع الأونلاين"
            value={form.meeting_url}
            onChange={(e) => setField('meeting_url', e.target.value)}
            className="auth-form__span-full"
            dir="ltr"
          />
          <FormInput
            id="ce-hours"
            label="ساعات التدريب المطلوبة"
            type="number"
            value={form.required_hours}
            onChange={(e) => setField('required_hours', e.target.value)}
          />
          <FormInput
            id="ce-sessions"
            label="عدد الجلسات المتوقع"
            type="number"
            value={form.expected_sessions}
            onChange={(e) => setField('expected_sessions', e.target.value)}
          />
          <FormInput
            id="ce-capacity"
            label="السعة"
            type="number"
            value={form.max_participants}
            onChange={(e) => setField('max_participants', e.target.value)}
          />
          <FormInput
            id="ce-attendance"
            label="حد الحضور (%)"
            type="number"
            value={form.required_attendance_pct}
            onChange={(e) => setField('required_attendance_pct', e.target.value)}
          />
        </div>
      </SectionCard>

      <SectionCard title="الأهداف والمخرجات">
        <FormTextarea
          id="ce-objectives"
          label="الأهداف"
          value={form.objectives}
          onChange={(e) => setField('objectives', e.target.value)}
        />
        <FormTextarea
          id="ce-outcomes"
          label="مخرجات التعلم"
          value={form.outcomes}
          onChange={(e) => setField('outcomes', e.target.value)}
        />
      </SectionCard>

      <SectionCard title="الحضور والإكمال / الاختبارات والتقييم">
        <div className="auth-form__fields-grid">
          <label className="form-field">
            <span>يتطلب اختبارًا قبليًا</span>
            <input
              type="checkbox"
              checked={form.requires_pre_test}
              onChange={(e) => setField('requires_pre_test', e.target.checked)}
            />
          </label>
          <label className="form-field">
            <span>يتطلب اختبارًا بعديًا</span>
            <input
              type="checkbox"
              checked={form.requires_post_test}
              onChange={(e) => setField('requires_post_test', e.target.checked)}
            />
          </label>
          <label className="form-field">
            <span>يتطلب مهمات</span>
            <input
              type="checkbox"
              checked={form.requires_tasks}
              onChange={(e) => setField('requires_tasks', e.target.checked)}
            />
          </label>
          <label className="form-field">
            <span>يتطلب مهمة نهائية</span>
            <input
              type="checkbox"
              checked={form.requires_final_task}
              onChange={(e) => setField('requires_final_task', e.target.checked)}
            />
          </label>
          <label className="form-field">
            <span>يتطلب تقييمًا نهائيًا</span>
            <input
              type="checkbox"
              checked={form.requires_evaluation}
              onChange={(e) => setField('requires_evaluation', e.target.checked)}
            />
          </label>
        </div>
      </SectionCard>

      <SectionCard title="التسجيل والسعة / الإعدادات والنشر">
        <div className="auth-form__fields-grid">
          <label className="form-field">
            <span>التسجيل متاح</span>
            <input
              type="checkbox"
              checked={form.enrollment_open}
              onChange={(e) => setField('enrollment_open', e.target.checked)}
            />
          </label>
          <FormSelect
            id="ce-visibility"
            label="الظهور"
            value={form.visibility}
            onChange={(e) => setField('visibility', e.target.value)}
          >
            <option value="ENROLLED">للمسجلين</option>
            <option value="ORG">داخل المؤسسة</option>
            <option value="PUBLIC">عام</option>
          </FormSelect>
          <FormInput
            id="ce-tz"
            label="المنطقة الزمنية"
            value={form.timezone}
            onChange={(e) => setField('timezone', e.target.value)}
          />
          {allowStatus ? (
            <FormSelect
              id="ce-status"
              label="حالة النشر"
              value={form.status}
              onChange={(e) => setField('status', e.target.value)}
            >
              <option value="DRAFT">مسودة</option>
              <option value="PUBLISHED">منشورة</option>
              <option value="REGISTRATION_OPEN">التسجيل مفتوح</option>
              <option value="REGISTRATION_CLOSED">التسجيل مغلق</option>
              <option value="IN_PROGRESS">قيد التنفيذ</option>
              <option value="COMPLETED">مكتملة</option>
              <option value="ARCHIVED">مؤرشفة</option>
            </FormSelect>
          ) : (
            <p className="auth-register__helper">حالة النشر تُدار بواسطة مسؤول المؤسسة.</p>
          )}
        </div>
      </SectionCard>

      <div className="course-edit-form__actions">
        <Button type="submit" variant="primary" disabled={saving || !form.title.trim()}>
          {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            إلغاء
          </Button>
        ) : null}
      </div>
    </form>
  );
}

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormInput } from '../../../components/forms/FormInput.jsx';
import { FormSelect } from '../../../components/forms/FormSelect.jsx';
import { FormTextarea } from '../../../components/forms/FormTextarea.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { getProgram, updateProgram } from '../../../features/training/training.service.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';

export function AdminTrainingCourseEditPage() {
  const { programId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    status: 'DRAFT',
    required_hours: '',
    required_attendance_pct: '',
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const course = await getProgram(programId);
        if (cancelled) return;
        setForm({
          title: course.title || '',
          description: course.description || '',
          status: course.status || 'DRAFT',
          required_hours: course.requiredHours != null ? String(course.requiredHours) : '',
          required_attendance_pct:
            course.requiredAttendancePct != null ? String(course.requiredAttendancePct) : '',
        });
      } catch (err) {
        if (!cancelled) setError(getApiErrorMessage(err, 'تعذر تحميل الدورة.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [programId]);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await updateProgram(programId, {
        title: form.title.trim(),
        description: form.description,
        status: form.status,
        required_hours: form.required_hours !== '' ? Number(form.required_hours) : undefined,
        required_attendance_pct:
          form.required_attendance_pct !== '' ? Number(form.required_attendance_pct) : undefined,
      });
      navigate(`/admin/training-courses/${programId}`, { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذر حفظ التعديلات.'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="page page--dashboard page--admin" dir="rtl">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="page page--dashboard page--admin crud-page" dir="rtl">
      <AdminPageHeader title="تعديل الدورة التدريبية" />
      <p style={{ marginBottom: '1rem' }}>
        <Link className="link" to={`/admin/training-courses/${programId}`}>
          ← العودة لإدارة الدورة
        </Link>
      </p>
      <SectionCard title="البيانات الأساسية">
        <form className="crud-form" onSubmit={onSubmit}>
          {error ? (
            <p className="form-field__error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="auth-form__fields-grid">
            <FormInput
              id="edit-title"
              label="اسم الدورة"
              required
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              className="auth-form__span-full"
            />
            <FormTextarea
              id="edit-description"
              label="الوصف"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              className="auth-form__span-full"
            />
            <FormSelect
              id="edit-status"
              label="الحالة"
              value={form.status}
              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
            >
              <option value="DRAFT">مسودة</option>
              <option value="PUBLISHED">منشورة</option>
              <option value="REGISTRATION_OPEN">التسجيل مفتوح</option>
              <option value="IN_PROGRESS">قيد التنفيذ</option>
              <option value="COMPLETED">مكتملة</option>
              <option value="ARCHIVED">مؤرشفة</option>
            </FormSelect>
            <FormInput
              id="edit-hours"
              label="الساعات المطلوبة"
              type="number"
              value={form.required_hours}
              onChange={(e) => setForm((p) => ({ ...p, required_hours: e.target.value }))}
            />
            <FormInput
              id="edit-attendance"
              label="نسبة الحضور"
              type="number"
              value={form.required_attendance_pct}
              onChange={(e) => setForm((p) => ({ ...p, required_attendance_pct: e.target.value }))}
            />
          </div>
          <Button type="submit" variant="primary" disabled={saving || !form.title.trim()}>
            {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </Button>
        </form>
      </SectionCard>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormInput } from '../../../components/forms/FormInput.jsx';
import { FormSelect } from '../../../components/forms/FormSelect.jsx';
import { FormTextarea } from '../../../components/forms/FormTextarea.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { createProgram } from '../../../features/training/training.service.js';
import { listBranches, listOrganizations } from '../../../features/organizations/organizations.service.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import { useAuth } from '../../../features/auth/index.js';
import { ROLES } from '../../../constants/roles.js';

const INITIAL = {
  title: '',
  short_description: '',
  description: '',
  field: '',
  level: '',
  language: 'ar',
  objectives: '',
  outcomes: '',
  delivery_mode: 'in_person',
  start_date: '',
  end_date: '',
  required_hours: '',
  expected_sessions: '',
  max_participants: '',
  requires_pre_test: false,
  requires_post_test: false,
  requires_tasks: true,
  requires_final_task: false,
  requires_evaluation: false,
  required_attendance_pct: '80',
  pass_score: '60',
  status: 'DRAFT',
};

export function AdminTrainingCourseCreatePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isSuperAdmin = Boolean(user?.isGlobal || user?.role === ROLES.SUPER_ADMIN);
  const scopedOrgId = user?.organizationId || null;

  const [institutions, setInstitutions] = useState([]);
  const [branches, setBranches] = useState([]);
  const [organizationId, setOrganizationId] = useState(
    isSuperAdmin ? searchParams.get('organizationId') || '' : scopedOrgId || ''
  );
  const [branchIds, setBranchIds] = useState([]);
  const [form, setForm] = useState(INITIAL);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (isSuperAdmin) {
          const orgs = await listOrganizations({ type: 'INSTITUTION' });
          if (!cancelled) {
            const active = (Array.isArray(orgs) ? orgs : []).filter((o) => o.status === 'active');
            setInstitutions(active);
            if (!organizationId && active[0]) setOrganizationId(active[0].id);
          }
        } else if (scopedOrgId) {
          setOrganizationId(scopedOrgId);
        }
      } catch (err) {
        if (!cancelled) {
          setError(getApiErrorMessage(err, 'تعذر تحميل المؤسسات.'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin, scopedOrgId]);

  useEffect(() => {
    if (!organizationId) {
      setBranches([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const rows = await listBranches(organizationId);
        if (!cancelled) setBranches(Array.isArray(rows) ? rows : []);
      } catch {
        if (!cancelled) setBranches([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const institutionName = useMemo(() => {
    if (!isSuperAdmin) return user?.organization?.name || 'مؤسستك';
    return institutions.find((o) => o.id === organizationId)?.name || '';
  }, [isSuperAdmin, institutions, organizationId, user]);

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e, publish = false) {
    e.preventDefault();
    if (!organizationId) {
      setError('يجب تحديد المؤسسة.');
      return;
    }
    if (!form.title.trim() || !form.description.trim() || !form.objectives.trim() || !form.outcomes.trim()) {
      setError('أكمل الحقول الأساسية المطلوبة: الاسم، الوصف، الأهداف، والمخرجات.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const body = {
        title: form.title.trim(),
        short_description: form.short_description.trim() || null,
        description: form.description.trim(),
        field: form.field.trim() || null,
        level: form.level.trim() || null,
        language: form.language || 'ar',
        objectives: form.objectives.trim(),
        outcomes: form.outcomes.trim(),
        delivery_mode: form.delivery_mode || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        required_hours: form.required_hours !== '' ? Number(form.required_hours) : null,
        expected_sessions: form.expected_sessions !== '' ? Number(form.expected_sessions) : null,
        max_participants: form.max_participants !== '' ? Number(form.max_participants) : null,
        required_attendance_pct:
          form.required_attendance_pct !== '' ? Number(form.required_attendance_pct) : 80,
        pass_score: form.pass_score !== '' ? Number(form.pass_score) : null,
        requires_pre_test: Boolean(form.requires_pre_test),
        requires_post_test: Boolean(form.requires_post_test),
        requires_tasks: Boolean(form.requires_tasks),
        requires_final_task: Boolean(form.requires_final_task),
        requires_evaluation: Boolean(form.requires_evaluation),
        status: publish ? 'PUBLISHED' : 'DRAFT',
      };
      const created = await createProgram(organizationId, body);
      navigate(`/admin/training-courses/${created.id}`, {
        replace: true,
        state: { branchIds },
      });
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذر حفظ الدورة التدريبية.'));
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

  if (!isSuperAdmin && !scopedOrgId) {
    return (
      <div className="page page--dashboard page--admin" dir="rtl">
        <AdminPageHeader title="إنشاء دورة تدريبية" />
        <p className="form-field__error" role="alert">
          لا يوجد ارتباط نشط بين حسابك وأي مؤسسة. يرجى التواصل مع إدارة النظام.
        </p>
      </div>
    );
  }

  return (
    <div className="page page--dashboard page--admin crud-page" dir="rtl">
      <AdminPageHeader
        title="إنشاء دورة تدريبية"
        description="تُنشأ الدورة دائمًا بنوع TRAINING_COURSE داخل محرك التدريب المشترك."
      />

      <p style={{ marginBottom: '1rem' }}>
        <Link className="link" to="/admin/training-courses">
          ← العودة إلى الدورات التدريبية
        </Link>
      </p>

      <form className="crud-form" onSubmit={(e) => onSubmit(e, false)}>
        {error ? (
          <p className="form-field__error" role="alert">
            {error}
          </p>
        ) : null}

        <SectionCard title="1) المعلومات الأساسية">
          <div className="auth-form__fields-grid">
            <FormInput
              id="title"
              label="اسم الدورة"
              required
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              className="auth-form__span-full"
            />
            <FormInput
              id="short_description"
              label="الوصف المختصر"
              value={form.short_description}
              onChange={(e) => setField('short_description', e.target.value)}
              className="auth-form__span-full"
            />
            <FormTextarea
              id="description"
              label="الوصف الكامل"
              required
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              className="auth-form__span-full"
              rows={4}
            />
            <FormInput
              id="field"
              label="مجال الدورة"
              required
              value={form.field}
              onChange={(e) => setField('field', e.target.value)}
            />
            <FormSelect
              id="level"
              label="مستوى الدورة"
              required
              value={form.level}
              onChange={(e) => setField('level', e.target.value)}
            >
              <option value="">اختر المستوى</option>
              <option value="beginner">مبتدئ</option>
              <option value="intermediate">متوسط</option>
              <option value="advanced">متقدم</option>
            </FormSelect>
            <FormSelect
              id="language"
              label="لغة التدريب"
              required
              value={form.language}
              onChange={(e) => setField('language', e.target.value)}
            >
              <option value="ar">العربية</option>
              <option value="en">English</option>
              <option value="bilingual">ثنائي اللغة</option>
            </FormSelect>
            <FormTextarea
              id="objectives"
              label="الأهداف"
              required
              value={form.objectives}
              onChange={(e) => setField('objectives', e.target.value)}
              className="auth-form__span-full"
              rows={3}
            />
            <FormTextarea
              id="outcomes"
              label="المخرجات التعليمية"
              required
              value={form.outcomes}
              onChange={(e) => setField('outcomes', e.target.value)}
              className="auth-form__span-full"
              rows={3}
            />
          </div>
        </SectionCard>

        <SectionCard title="2) نطاق المؤسسة">
          {isSuperAdmin ? (
            <FormSelect
              id="organizationId"
              label="المؤسسة"
              required
              value={organizationId}
              onChange={(e) => {
                setOrganizationId(e.target.value);
                setBranchIds([]);
              }}
            >
              <option value="">اختر مؤسسة نشطة</option>
              {institutions.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </FormSelect>
          ) : (
            <p className="auth-register__helper">
              المؤسسة: <strong>{institutionName}</strong> (مقفلة من نطاق حسابك — لا يمكن تغييرها من الواجهة)
            </p>
          )}
          {branches.length ? (
            <div style={{ marginTop: '0.75rem' }}>
              <p className="form-field__label">الفروع المرتبطة (اختياري للمرجع عند إنشاء الدفعات)</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                {branches.map((b) => {
                  const checked = branchIds.includes(b.id);
                  return (
                    <label key={b.id} style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setBranchIds((prev) =>
                            checked ? prev.filter((id) => id !== b.id) : [...prev, b.id]
                          )
                        }
                      />
                      {b.name}
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}
        </SectionCard>

        <SectionCard title="3) معلومات التنفيذ">
          <div className="auth-form__fields-grid">
            <FormSelect
              id="delivery_mode"
              label="طريقة التدريب"
              required
              value={form.delivery_mode}
              onChange={(e) => setField('delivery_mode', e.target.value)}
            >
              <option value="in_person">حضوري</option>
              <option value="online">أونلاين</option>
              <option value="hybrid">هجين</option>
              <option value="self_paced">تعلم ذاتي</option>
            </FormSelect>
            <FormInput
              id="start_date"
              label="تاريخ البداية"
              type="date"
              value={form.start_date}
              onChange={(e) => setField('start_date', e.target.value)}
            />
            <FormInput
              id="end_date"
              label="تاريخ النهاية"
              type="date"
              value={form.end_date}
              onChange={(e) => setField('end_date', e.target.value)}
            />
            <FormInput
              id="required_hours"
              label="إجمالي الساعات"
              type="number"
              min="0"
              value={form.required_hours}
              onChange={(e) => setField('required_hours', e.target.value)}
            />
            <FormInput
              id="expected_sessions"
              label="العدد المتوقع للجلسات"
              type="number"
              min="0"
              value={form.expected_sessions}
              onChange={(e) => setField('expected_sessions', e.target.value)}
            />
            <FormInput
              id="max_participants"
              label="السعة القصوى"
              type="number"
              min="1"
              value={form.max_participants}
              onChange={(e) => setField('max_participants', e.target.value)}
            />
          </div>
        </SectionCard>

        <SectionCard title="4) متطلبات الدورة">
          <div className="auth-form__fields-grid">
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={form.requires_pre_test}
                onChange={(e) => setField('requires_pre_test', e.target.checked)}
              />
              الاختبار القبلي مطلوب؟
            </label>
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={form.requires_post_test}
                onChange={(e) => setField('requires_post_test', e.target.checked)}
              />
              الاختبار البعدي مطلوب؟
            </label>
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={form.requires_tasks}
                onChange={(e) => setField('requires_tasks', e.target.checked)}
              />
              المهمات مطلوبة؟
            </label>
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={form.requires_final_task}
                onChange={(e) => setField('requires_final_task', e.target.checked)}
              />
              المهمة النهائية مطلوبة؟
            </label>
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={form.requires_evaluation}
                onChange={(e) => setField('requires_evaluation', e.target.checked)}
              />
              تقييم الدورة مطلوب؟
            </label>
            <FormInput
              id="required_attendance_pct"
              label="الحد الأدنى للحضور (%)"
              type="number"
              min="0"
              max="100"
              value={form.required_attendance_pct}
              onChange={(e) => setField('required_attendance_pct', e.target.value)}
            />
            <FormInput
              id="pass_score"
              label="درجة النجاح"
              type="number"
              min="0"
              max="100"
              value={form.pass_score}
              onChange={(e) => setField('pass_score', e.target.value)}
            />
          </div>
        </SectionCard>

        <SectionCard title="5) النشر">
          <p className="auth-register__helper">
            الحالة الابتدائية: مسودة. يمكنك الحفظ كمسودة أو النشر عند اكتمال البيانات المطلوبة.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Button type="submit" variant="outline" disabled={saving}>
              {saving ? 'جاري الحفظ...' : 'حفظ كمسودة'}
            </Button>
            <Button type="button" variant="primary" disabled={saving} onClick={(e) => onSubmit(e, true)}>
              {saving ? 'جاري النشر...' : 'حفظ ونشر'}
            </Button>
          </div>
        </SectionCard>
      </form>
    </div>
  );
}

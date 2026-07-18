import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowRight,
  KeyRound,
  MailCheck,
  Pencil,
  Save,
  UserCheck,
  UserX,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import { FormInput, FormSelect } from '../../../components/forms/index.js';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { ConfirmDeleteModal } from '../../../components/modals/ConfirmDeleteModal.jsx';
import { genericStatusVariant } from '../../../utils/statusMap.js';
import { roleLabelAr } from '../../../utils/labelsAr.js';
import { useLocale } from '../../../features/locale/index.js';
import { useAuth } from '../../../features/auth/index.js';
import { useUniversities } from '../../../features/universities/index.js';
import { useUniversitySpecialties, getUniversitySpecialtyLabel } from '../../../features/specialties/index.js';
import {
  useUser,
  useUpdateUser,
  useUpdateUserStatus,
  useVerifyUserEmail,
  useActivateUser,
  useAdminResetUserPassword,
  canManageUsers,
  canActivateUsers,
} from '../../../features/users/index.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import { ASSIGNABLE_USER_ROLE_CODES, ROLES } from '../../../constants/roles.js';

const TABS = ['personal', 'academic', 'account', 'activity'];

/** Roles offered when changing account role (excludes deprecated program_admin). */
const VIEW_ASSIGNABLE_ROLE_CODES = [...ASSIGNABLE_USER_ROLE_CODES, ROLES.UNIVERSITY_ADMIN];

function formatDt(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function UserViewPage() {
  const { t } = useTranslation('users');
  const { t: tCommon } = useTranslation('common');
  const { locale } = useLocale();
  const { user: authUser } = useAuth();
  const { id } = useParams();
  const canWrite = canManageUsers(authUser);
  const canActivate = canActivateUsers(authUser);

  const { data: row, isLoading, isError } = useUser(id);
  const updateUser = useUpdateUser();
  const updateStatus = useUpdateUserStatus();
  const verifyEmail = useVerifyUserEmail();
  const activateUser = useActivateUser();
  const resetPassword = useAdminResetUserPassword();
  const universitiesQuery = useUniversities({ enabled: canWrite });

  const [tab, setTab] = useState('personal');
  const [feedback, setFeedback] = useState('');
  const [formError, setFormError] = useState('');
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState(null);
  const [roleConfirmOpen, setRoleConfirmOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [passwords, setPasswords] = useState({ new_password: '', confirm_password: '' });

  const [form, setForm] = useState(null);

  useEffect(() => {
    if (!row) return;
    const primaryRole = Array.isArray(row.roles) && row.roles.length ? row.roles[0] : 'student';
    setForm({
      full_name: row.full_name || '',
      email: row.email || '',
      phone: row.phone || '',
      status: row.status || 'inactive',
      primary_university_id: row.primary_university_id || '',
      university_specialty_id: row.university_specialty_id || '',
      specialty_id: row.specialty_id || '',
      role_code: primaryRole,
    });
  }, [row]);

  const uniId = form?.primary_university_id || '';
  const specialtiesQuery = useUniversitySpecialties(uniId || null);
  const specialties = Array.isArray(specialtiesQuery.data) ? specialtiesQuery.data : [];
  const specialtyList = specialties;

  const universities = useMemo(() => {
    const payload = universitiesQuery.data;
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.universities)) return payload.universities;
    if (Array.isArray(payload?.items)) return payload.items;
    return [];
  }, [universitiesQuery.data]);

  function setField(key, value) {
    setForm((f) => {
      if (!f) return f;
      const next = { ...f, [key]: value };
      if (key === 'primary_university_id') {
        next.university_specialty_id = '';
        next.specialty_id = '';
      }
      if (key === 'university_specialty_id') {
        const selected = specialtyList.find((s) => String(s.id) === String(value));
        next.specialty_id = selected?.specialty_id || selected?.canonical_specialty_id || '';
      }
      return next;
    });
  }

  async function saveProfile(e) {
    e?.preventDefault?.();
    if (!canWrite || !form || !id) return;
    setFormError('');
    setFeedback('');
    try {
      const body = {
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone?.trim() || null,
        status: form.status,
        primary_university_id: form.primary_university_id || null,
        university_specialty_id: form.university_specialty_id || null,
        specialty_id: form.specialty_id || null,
      };
      // Never resubmit deprecated program_admin; omit role_codes to preserve legacy holders.
      if (form.role_code !== ROLES.PROGRAM_ADMIN) {
        body.role_codes = [form.role_code];
      }
      await updateUser.mutateAsync({ id, body });
      setFeedback(t('detail.saveSuccess'));
      setRoleConfirmOpen(false);
    } catch (err) {
      setFormError(getApiErrorMessage(err, tCommon('errors.generic')));
    }
  }

  async function onSaveClick(e) {
    e.preventDefault();
    if (!row || !form) return;
    const prevRole = Array.isArray(row.roles) && row.roles.length ? row.roles[0] : '';
    const uniChanged =
      String(form.primary_university_id || '') !== String(row.primary_university_id || '');
    const roleChanged = form.role_code !== prevRole;
    if (roleChanged || uniChanged) {
      setRoleConfirmOpen(true);
      return;
    }
    await saveProfile();
  }

  async function confirmStatus() {
    if (!statusTarget || !id) return;
    setFeedback('');
    try {
      if (statusTarget === 'activate_pending') {
        await activateUser.mutateAsync(id);
        setFeedback(t('list.activateSuccess'));
      } else {
        await updateStatus.mutateAsync({ id, status: statusTarget });
        setFeedback(t('detail.statusUpdated'));
      }
      setStatusTarget(null);
    } catch (err) {
      setFeedback(getApiErrorMessage(err, tCommon('errors.generic')));
      setStatusTarget(null);
    }
  }

  async function confirmVerify() {
    if (!id) return;
    setFeedback('');
    try {
      const result = await verifyEmail.mutateAsync(id);
      setFeedback(result?.message || t('list.verifyEmailSuccess'));
      setVerifyOpen(false);
    } catch (err) {
      setFeedback(getApiErrorMessage(err, tCommon('errors.generic')));
      setVerifyOpen(false);
    }
  }

  async function confirmResetPassword() {
    if (!id) return;
    setFormError('');
    try {
      await resetPassword.mutateAsync({
        id,
        body: {
          new_password: passwords.new_password,
          confirm_password: passwords.confirm_password,
        },
      });
      setFeedback(t('detail.resetPasswordSuccess'));
      setResetOpen(false);
      setPasswords({ new_password: '', confirm_password: '' });
    } catch (err) {
      setFormError(getApiErrorMessage(err, tCommon('errors.generic')));
    }
  }

  if (isLoading || !form) {
    return (
      <div className="page page--admin crud-page">
        <LoadingSpinner />
      </div>
    );
  }

  if (isError || !row) {
    return (
      <div className="page page--admin crud-page">
        <AdminPageHeader title={t('view.notFound')} description={t('view.description')} />
        <Link className="btn btn--primary" to="/admin/users">
          {t('detail.backToList')}
        </Link>
      </div>
    );
  }

  const emailVerified = Boolean(row.email_verified_at);
  const primaryRole = Array.isArray(row.roles) && row.roles.length ? row.roles[0] : '';
  const accountLabel =
    row.status === 'active'
      ? t('list.accountActive')
      : row.status === 'suspended'
        ? t('list.accountSuspended')
        : t('list.accountInactive');
  const activity = row.activity || {};
  const audits = Array.isArray(row.recent_audits) ? row.recent_audits : [];
  const busy =
    updateUser.isPending ||
    updateStatus.isPending ||
    verifyEmail.isPending ||
    activateUser.isPending ||
    resetPassword.isPending;

  return (
    <div className="page page--dashboard page--admin crud-page page--admin-user-detail">
      <AdminPageHeader
        breadcrumb={t('detail.breadcrumb')}
        title={row.full_name}
        description={row.email}
        actions={
          <Link className="btn btn--outline" to="/admin/users">
            <ArrowRight size={16} aria-hidden />
            {t('detail.backToList')}
          </Link>
        }
      />

      <section className="admin-user-hero">
        <div className="admin-user-hero__avatar" aria-hidden>
          {initials(row.full_name)}
        </div>
        <div className="admin-user-hero__info">
          <h2 className="admin-user-hero__name">{row.full_name}</h2>
          <p className="admin-user-hero__email">{row.email}</p>
          <div className="admin-user-hero__badges">
            <StatusBadge variant="info">{roleLabelAr(primaryRole, locale)}</StatusBadge>
            <StatusBadge variant={genericStatusVariant(row.status)}>{accountLabel}</StatusBadge>
            <StatusBadge variant={emailVerified ? 'success' : 'warning'}>
              {emailVerified ? t('list.emailVerified') : t('list.emailNotVerified')}
            </StatusBadge>
            {row.primary_university?.name ? (
              <StatusBadge variant="muted">{row.primary_university.name}</StatusBadge>
            ) : null}
          </div>
        </div>
        <div className="admin-user-hero__actions">
          {canActivate && !emailVerified ? (
            <button
              type="button"
              className="btn btn--outline btn--sm"
              disabled={busy}
              onClick={() => setVerifyOpen(true)}
            >
              <MailCheck size={16} aria-hidden />
              {t('list.verifyEmail')}
            </button>
          ) : null}
          {canActivate && row.status === 'inactive' ? (
            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={busy || !emailVerified}
              onClick={() => setStatusTarget('activate_pending')}
            >
              <UserCheck size={16} aria-hidden />
              {t('list.activateAccount')}
            </button>
          ) : null}
          {canWrite && row.status === 'active' ? (
            <button
              type="button"
              className="btn btn--outline btn--sm"
              disabled={busy}
              onClick={() => setStatusTarget('suspended')}
            >
              <UserX size={16} aria-hidden />
              {t('list.deactivateAccount')}
            </button>
          ) : null}
          {canWrite && row.status === 'suspended' ? (
            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={busy}
              onClick={() => setStatusTarget('active')}
            >
              <UserCheck size={16} aria-hidden />
              {t('detail.reactivate')}
            </button>
          ) : null}
          {canWrite ? (
            <button
              type="button"
              className="btn btn--outline btn--sm"
              disabled={busy}
              onClick={() => setResetOpen(true)}
            >
              <KeyRound size={16} aria-hidden />
              {t('detail.resetPassword')}
            </button>
          ) : null}
          {canWrite ? (
            <Link className="btn btn--outline btn--sm" to={`/admin/users/${id}/edit`}>
              <Pencil size={16} aria-hidden />
              {tCommon('actions.edit')}
            </Link>
          ) : null}
        </div>
      </section>

      {feedback ? (
        <p className="auth-register__helper" role="status">
          {feedback}
        </p>
      ) : null}
      {formError ? <p className="form-error">{formError}</p> : null}

      <div className="admin-user-tabs" role="tablist">
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`admin-user-tabs__tab${tab === key ? ' is-active' : ''}`}
            onClick={() => setTab(key)}
          >
            {t(`detail.tabs.${key}`)}
          </button>
        ))}
      </div>

      {tab === 'personal' ? (
        <SectionCard title={t('detail.tabs.personal')}>
          {canWrite ? (
            <form className="crud-form-grid" onSubmit={onSaveClick}>
              <FormInput
                id="full_name"
                label={t('detail.fields.fullName')}
                value={form.full_name}
                onChange={(e) => setField('full_name', e.target.value)}
                required
              />
              <FormInput
                id="email"
                label={t('detail.fields.email')}
                type="email"
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
                required
              />
              <FormInput
                id="phone"
                label={t('detail.fields.phone')}
                value={form.phone}
                onChange={(e) => setField('phone', e.target.value)}
              />
              <div className="crud-form-actions">
                <button type="submit" className="btn btn--primary" disabled={busy}>
                  <Save size={16} aria-hidden />
                  {t('detail.save')}
                </button>
              </div>
            </form>
          ) : (
            <dl className="crud-dl">
              <div>
                <dt>{t('detail.fields.fullName')}</dt>
                <dd>{row.full_name}</dd>
              </div>
              <div>
                <dt>{t('detail.fields.email')}</dt>
                <dd>{row.email}</dd>
              </div>
              <div>
                <dt>{t('detail.fields.phone')}</dt>
                <dd>{row.phone || '—'}</dd>
              </div>
            </dl>
          )}
        </SectionCard>
      ) : null}

      {tab === 'academic' ? (
        <SectionCard title={t('detail.tabs.academic')}>
          {canWrite ? (
            <form className="crud-form-grid" onSubmit={onSaveClick}>
              <FormSelect
                id="university"
                label={t('detail.fields.university')}
                value={form.primary_university_id}
                onChange={(e) => setField('primary_university_id', e.target.value)}
              >
                <option value="">—</option>
                {universities.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </FormSelect>
              <FormSelect
                id="uni_specialty"
                label={t('detail.fields.universitySpecialty')}
                value={form.university_specialty_id}
                onChange={(e) => setField('university_specialty_id', e.target.value)}
                disabled={!form.primary_university_id}
              >
                <option value="">—</option>
                {specialtyList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {getUniversitySpecialtyLabel?.(s, locale) || s.name_ar || s.name_en || s.code}
                  </option>
                ))}
              </FormSelect>
              <div className="crud-form-actions">
                <button type="submit" className="btn btn--primary" disabled={busy}>
                  <Save size={16} aria-hidden />
                  {t('detail.save')}
                </button>
              </div>
            </form>
          ) : (
            <dl className="crud-dl">
              <div>
                <dt>{t('detail.fields.university')}</dt>
                <dd>{row.primary_university?.name || '—'}</dd>
              </div>
              <div>
                <dt>{t('detail.fields.universitySpecialty')}</dt>
                <dd>
                  {row.university_specialty?.name_ar ||
                    row.university_specialty?.name_en ||
                    '—'}
                </dd>
              </div>
              <div>
                <dt>{t('detail.fields.specialty')}</dt>
                <dd>{row.specialty?.name_ar || row.specialty?.name_en || '—'}</dd>
              </div>
            </dl>
          )}
        </SectionCard>
      ) : null}

      {tab === 'account' ? (
        <SectionCard title={t('detail.tabs.account')}>
          {canWrite ? (
            <form className="crud-form-grid" onSubmit={onSaveClick}>
              <FormSelect
                id="role"
                label={t('detail.fields.role')}
                value={form.role_code}
                onChange={(e) => setField('role_code', e.target.value)}
              >
                {form.role_code === ROLES.PROGRAM_ADMIN ? (
                  <option value={ROLES.PROGRAM_ADMIN}>{roleLabelAr(ROLES.PROGRAM_ADMIN, locale)}</option>
                ) : null}
                {VIEW_ASSIGNABLE_ROLE_CODES.map((code) => (
                  <option key={code} value={code}>
                    {roleLabelAr(code, locale)}
                  </option>
                ))}
              </FormSelect>
              <FormSelect
                id="status"
                label={t('table.accountStatus')}
                value={form.status}
                onChange={(e) => setField('status', e.target.value)}
              >
                <option value="active">{t('list.accountActive')}</option>
                <option value="inactive">{t('list.accountInactive')}</option>
                <option value="suspended">{t('list.accountSuspended')}</option>
              </FormSelect>
              <div>
                <span className="form-label">{t('table.emailVerified')}</span>
                <div style={{ marginTop: 8 }}>
                  <StatusBadge variant={emailVerified ? 'success' : 'warning'}>
                    {emailVerified ? t('list.emailVerified') : t('list.emailNotVerified')}
                  </StatusBadge>
                </div>
              </div>
              <div className="crud-form-actions">
                <button type="submit" className="btn btn--primary" disabled={busy}>
                  <Save size={16} aria-hidden />
                  {t('detail.save')}
                </button>
              </div>
            </form>
          ) : (
            <dl className="crud-dl">
              <div>
                <dt>{t('detail.fields.role')}</dt>
                <dd>{roleLabelAr(primaryRole, locale)}</dd>
              </div>
              <div>
                <dt>{t('table.accountStatus')}</dt>
                <dd>
                  <StatusBadge variant={genericStatusVariant(row.status)}>{accountLabel}</StatusBadge>
                </dd>
              </div>
              <div>
                <dt>{t('table.emailVerified')}</dt>
                <dd>
                  <StatusBadge variant={emailVerified ? 'success' : 'warning'}>
                    {emailVerified ? t('list.emailVerified') : t('list.emailNotVerified')}
                  </StatusBadge>
                </dd>
              </div>
            </dl>
          )}
        </SectionCard>
      ) : null}

      {tab === 'activity' ? (
        <SectionCard title={t('detail.tabs.activity')}>
          <dl className="crud-dl">
            <div>
              <dt>{t('table.lastLogin')}</dt>
              <dd>{formatDt(row.last_login_at)}</dd>
            </div>
            <div>
              <dt>{t('table.createdAt')}</dt>
              <dd>{formatDt(row.created_at)}</dd>
            </div>
            <div>
              <dt>{t('detail.fields.updatedAt')}</dt>
              <dd>{formatDt(row.updated_at)}</dd>
            </div>
            <div>
              <dt>{t('detail.activity.enrollments')}</dt>
              <dd>{activity.enrollments_count ?? 0}</dd>
            </div>
            <div>
              <dt>{t('detail.activity.courses')}</dt>
              <dd>{activity.course_enrollments_count ?? 0}</dd>
            </div>
            <div>
              <dt>{t('detail.activity.fieldTraining')}</dt>
              <dd>{activity.field_training_applications_count ?? 0}</dd>
            </div>
            <div>
              <dt>{t('detail.activity.certificates')}</dt>
              <dd>{activity.certificates_count ?? 0}</dd>
            </div>
          </dl>
          {audits.length ? (
            <div className="admin-user-audit">
              <h3 className="admin-user-audit__title">{t('detail.activity.recentAudits')}</h3>
              <ul className="admin-user-audit__list">
                {audits.map((a) => (
                  <li key={a.id}>
                    <strong>{a.action_type}</strong>
                    <span>{formatDt(a.created_at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-muted">{t('detail.activity.noAudits')}</p>
          )}
        </SectionCard>
      ) : null}

      <ConfirmDeleteModal
        open={verifyOpen}
        title={t('list.verifyEmailConfirmTitle')}
        message={t('list.verifyEmailConfirmText')}
        confirmLabel={t('list.verifyEmailConfirm')}
        cancelLabel={tCommon('actions.cancel')}
        confirmVariant="primary"
        busy={verifyEmail.isPending}
        onClose={() => setVerifyOpen(false)}
        onConfirm={confirmVerify}
      />

      <ConfirmDeleteModal
        open={Boolean(statusTarget)}
        title={t('detail.statusConfirmTitle')}
        message={t('detail.statusConfirmText')}
        confirmLabel={tCommon('actions.confirm')}
        cancelLabel={tCommon('actions.cancel')}
        confirmVariant="primary"
        busy={updateStatus.isPending || activateUser.isPending}
        onClose={() => setStatusTarget(null)}
        onConfirm={confirmStatus}
      />

      <ConfirmDeleteModal
        open={roleConfirmOpen}
        title={t('detail.sensitiveConfirmTitle')}
        message={t('detail.sensitiveConfirmText')}
        confirmLabel={t('detail.save')}
        cancelLabel={tCommon('actions.cancel')}
        confirmVariant="primary"
        busy={updateUser.isPending}
        onClose={() => setRoleConfirmOpen(false)}
        onConfirm={saveProfile}
      />

      {resetOpen ? (
        <div className="modal-overlay" role="presentation" onMouseDown={() => setResetOpen(false)}>
          <div
            className="modal modal--confirm admin-user-reset-modal"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 className="modal__title">{t('detail.resetPassword')}</h2>
            <p className="modal__message">{t('detail.resetPasswordHint')}</p>
            <div className="admin-user-reset-form">
              <FormInput
                id="new_password"
                label={t('detail.fields.newPassword')}
                type="password"
                value={passwords.new_password}
                onChange={(e) => setPasswords((p) => ({ ...p, new_password: e.target.value }))}
                autoComplete="new-password"
              />
              <FormInput
                id="confirm_password"
                label={t('detail.fields.confirmPassword')}
                type="password"
                value={passwords.confirm_password}
                onChange={(e) => setPasswords((p) => ({ ...p, confirm_password: e.target.value }))}
                autoComplete="new-password"
              />
            </div>
            <div className="modal__actions">
              <button
                type="button"
                className="btn btn--outline"
                disabled={busy}
                onClick={() => {
                  setResetOpen(false);
                  setPasswords({ new_password: '', confirm_password: '' });
                }}
              >
                {tCommon('actions.cancel')}
              </button>
              <button
                type="button"
                className="btn btn--danger"
                disabled={busy || !passwords.new_password || passwords.new_password.length < 8}
                onClick={confirmResetPassword}
              >
                {t('detail.resetPassword')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

import { Link } from 'react-router-dom';
import { Eye, Pencil, MailCheck, UserCheck, UserX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { StatusBadge } from '../admin/StatusBadge.jsx';
import { genericStatusVariant } from '../../utils/statusMap.js';
import { roleLabelAr } from '../../utils/labelsAr.js';
import { useLocale } from '../../features/locale/index.js';

function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function accountStatusLabel(t, status) {
  if (status === 'active') return t('list.accountActive');
  if (status === 'suspended') return t('list.accountSuspended');
  return t('list.accountInactive');
}

/**
 * Admin users grid card — clickable to user detail.
 */
export function AdminUserCard({
  user,
  canWrite,
  canActivate,
  busy,
  onVerify,
  onActivate,
  onDeactivate,
}) {
  const { t } = useTranslation('users');
  const { t: tCommon } = useTranslation('common');
  const { locale } = useLocale();
  const to = `/admin/users/${user.id}`;
  const roles = Array.isArray(user.roles) ? user.roles : [];
  const isPendingStudent = user.status === 'inactive' && roles.includes('student');

  return (
    <article className="admin-user-card">
      <Link to={to} className="admin-user-card__main">
        <div className="admin-user-card__avatar" aria-hidden>
          {initials(user.name)}
        </div>
        <div className="admin-user-card__identity">
          <h3 className="admin-user-card__name">{user.name || '—'}</h3>
          <p className="admin-user-card__email">{user.email}</p>
        </div>
        <div className="admin-user-card__badges">
          <StatusBadge variant={user.emailVerified ? 'success' : 'warning'}>
            {user.emailVerified ? t('list.emailVerified') : t('list.emailNotVerified')}
          </StatusBadge>
          <StatusBadge variant={genericStatusVariant(user.status)}>
            {accountStatusLabel(t, user.status)}
          </StatusBadge>
          {isPendingStudent ? (
            <StatusBadge variant="warning">{t('list.pendingActivation')}</StatusBadge>
          ) : null}
        </div>
        <dl className="admin-user-card__meta">
          <div>
            <dt>{t('table.role')}</dt>
            <dd>{roleLabelAr(user.role, locale)}</dd>
          </div>
          <div>
            <dt>{t('table.university')}</dt>
            <dd>{user.universityName || '—'}</dd>
          </div>
          <div>
            <dt>{t('table.specialty')}</dt>
            <dd>{user.specialtyName || '—'}</dd>
          </div>
          <div>
            <dt>{t('table.lastLogin')}</dt>
            <dd>{user.lastLogin || '—'}</dd>
          </div>
          <div>
            <dt>{t('table.createdAt')}</dt>
            <dd>{user.createdAt || '—'}</dd>
          </div>
        </dl>
      </Link>

      <footer className="admin-user-card__actions">
        <Link to={to} className="btn btn--outline btn--sm" title={tCommon('actions.view')}>
          <Eye size={14} aria-hidden />
          {tCommon('actions.view')}
        </Link>
        {canWrite ? (
          <Link
            to={`/admin/users/${user.id}/edit`}
            className="btn btn--outline btn--sm"
            title={tCommon('actions.edit')}
          >
            <Pencil size={14} aria-hidden />
            {tCommon('actions.edit')}
          </Link>
        ) : null}
        {canActivate && !user.emailVerified ? (
          <button
            type="button"
            className="btn btn--outline btn--sm"
            disabled={busy}
            onClick={() => onVerify?.(user)}
          >
            <MailCheck size={14} aria-hidden />
            {t('list.verifyEmail')}
          </button>
        ) : null}
        {canActivate && isPendingStudent ? (
          <button
            type="button"
            className="btn btn--primary btn--sm"
            disabled={busy || !user.emailVerified}
            title={!user.emailVerified ? t('list.activateRequiresEmail') : undefined}
            onClick={() => onActivate?.(user)}
          >
            <UserCheck size={14} aria-hidden />
            {t('list.activateAccount')}
          </button>
        ) : null}
        {canWrite && user.status === 'active' ? (
          <button
            type="button"
            className="btn btn--outline btn--sm"
            disabled={busy}
            onClick={() => onDeactivate?.(user)}
          >
            <UserX size={14} aria-hidden />
            {t('list.deactivateAccount')}
          </button>
        ) : null}
      </footer>
    </article>
  );
}

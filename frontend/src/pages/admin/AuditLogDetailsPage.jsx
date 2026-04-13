import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { useAuditLog } from '../../features/auditLogs/hooks/useAuditLog.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';

function JsonBlock({ value }) {
  if (value == null) return <p className="crud-muted">—</p>;
  let text;
  try {
    text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  } catch {
    text = String(value);
  }
  return (
    <pre className="crud-json" style={{ whiteSpace: 'pre-wrap', overflow: 'auto' }}>
      {text}
    </pre>
  );
}

export function AuditLogDetailsPage() {
  const { t } = useTranslation('auditLogs');
  const { t: tCommon } = useTranslation('common');
  const { id } = useParams();
  const { data, isLoading, isError, error } = useAuditLog(id, { staleTime: 30_000 });
  const row = data?.audit_log;

  if (isLoading) {
    return (
      <div className="page page--admin crud-page">
        <p className="crud-muted">{tCommon('loading')}</p>
      </div>
    );
  }

  if (isError || !row) {
    return (
      <div className="page page--admin crud-page">
        <AdminPageHeader title={tCommon('errors.generic')} description={getApiErrorMessage(error, '')} />
        <Link className="btn btn--primary" to="/admin/audit-logs">
          {t('detail.back')}
        </Link>
      </div>
    );
  }

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title={t('detail.title')} description={t('detail.description')} />
      <SectionCard title={t('detail.title')}>
        <dl className="crud-dl">
          <div>
            <dt>{t('list.columns.time')}</dt>
            <dd>{row.created_at ? new Date(row.created_at).toLocaleString() : '—'}</dd>
          </div>
          <div>
            <dt>{t('list.columns.user')}</dt>
            <dd>{row.user?.full_name ?? row.user?.email ?? '—'}</dd>
          </div>
          <div>
            <dt>{t('list.columns.university')}</dt>
            <dd>{row.university?.name ?? '—'}</dd>
          </div>
          <div>
            <dt>{t('list.columns.action')}</dt>
            <dd>{row.action_type}</dd>
          </div>
          <div>
            <dt>{t('list.columns.entity')}</dt>
            <dd>{row.entity_type}</dd>
          </div>
          <div>
            <dt>{t('list.columns.entityId')}</dt>
            <dd>{row.entity_id ?? '—'}</dd>
          </div>
          <div>
            <dt>{t('detail.ip')}</dt>
            <dd>{row.ip_address ?? '—'}</dd>
          </div>
        </dl>
        <h3 className="crud-section-title">{t('detail.oldValues')}</h3>
        <JsonBlock value={row.old_values} />
        <h3 className="crud-section-title">{t('detail.newValues')}</h3>
        <JsonBlock value={row.new_values} />
        <div className="crud-view-actions">
          <Link className="btn btn--outline" to="/admin/audit-logs">
            {t('detail.back')}
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}

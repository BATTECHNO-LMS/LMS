import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AdminPageHeader, AdminFilterBar, SectionCard, SearchInput, SelectField } from '../../../components/admin/index.js';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { DataTable } from '../../../components/tables/DataTable.jsx';
import { useLocale, useTr } from '../../../features/locale/index.js';
import { fetchAuditLogsList } from '../../../features/auditLogs/auditLogs.service.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import { formatDate, isContentAuditAction } from './contentHub.shared.js';

const ENTITY_OPTIONS = [
  '',
  'help_articles',
  'help_categories',
  'user_guides',
  'managed_popup',
  'announcement',
];

export function ContentAuditPage() {
  const t = useTr();
  const { locale } = useLocale();
  const [q, setQ] = useState('');
  const [entityType, setEntityType] = useState('');

  const params = useMemo(() => {
    const p = {};
    if (entityType) p.entity_type = entityType;
    if (q.trim()) p.search = q.trim();
    return p;
  }, [entityType, q]);

  const auditQuery = useQuery({
    queryKey: ['admin', 'content-hub', 'audit', params],
    queryFn: () => fetchAuditLogsList(params),
    retry: false,
  });

  const rows = useMemo(() => {
    const list = auditQuery.data?.audit_logs ?? [];
    return list
      .filter((r) => isContentAuditAction(r.action_type) || (entityType && r.entity_type === entityType))
      .map((r) => ({
        id: r.id,
        time: formatDate(r.created_at, locale),
        actor: r.user?.full_name ?? r.user?.email ?? '—',
        action: r.action_type,
        resource: r.entity_type,
        entityId: r.entity_id ?? '—',
      }));
  }, [auditQuery.data, entityType, locale]);

  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader
        title={t('سجل التعديلات', 'Change history')}
        description={t(
          'أحداث التدقيق المتعلقة بالمساعدة والإعلانات والنوافذ والجولات',
          'Audit events for help, announcements, pop-ups, and tours'
        )}
      />
      <AdminFilterBar>
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('بحث…', 'Search…')}
          aria-label={t('بحث', 'Search')}
        />
        <SelectField
          id="content-audit-entity"
          label={t('نوع الكيان', 'Entity type')}
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
        >
          <option value="">{t('الكل (تصفية محلية)', 'All (client filter)')}</option>
          {ENTITY_OPTIONS.filter(Boolean).map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </SelectField>
      </AdminFilterBar>

      {(auditQuery.isError || (!auditQuery.isLoading && rows.length === 0)) && (
        <SectionCard title={t('ملاحظة', 'Note')}>
          <p>
            {t(
              'يتم عرض أحداث HELP_/ANNOUNCEMENT_/POPUP_/USER_GUIDE_ عبر تصفية محلية إن وُجدت. إن لم تظهر نتائج، راجع السجل الكامل.',
              'HELP_/ANNOUNCEMENT_/POPUP_/USER_GUIDE_ events are shown via client-side filtering when available. If empty, check the full audit log.'
            )}
          </p>
          <p style={{ marginTop: '0.75rem' }}>
            <Link className="btn btn--outline" to="/admin/audit-logs">
              {t('فتح سجل التدقيق الكامل', 'Open full audit log')}
            </Link>
          </p>
          {auditQuery.isError ? (
            <p className="form-error" style={{ marginTop: '0.75rem' }}>
              {getApiErrorMessage(auditQuery.error)}
            </p>
          ) : null}
        </SectionCard>
      )}

      <SectionCard title={t('أحداث المحتوى والمساعدة', 'Content & help events')}>
        {auditQuery.isLoading ? (
          <LoadingSpinner />
        ) : (
          <DataTable
            emptyTitle={t('لا توجد أحداث مطابقة', 'No matching events')}
            emptyDescription={t(
              'جرّب تغيير عوامل التصفية أو راجع السجل الكامل',
              'Try different filters or check the full audit log'
            )}
            columns={[
              { key: 'time', label: t('الوقت', 'Time') },
              { key: 'actor', label: t('المنفّذ', 'Actor') },
              { key: 'action', label: t('الإجراء', 'Action') },
              { key: 'resource', label: t('الكيان', 'Entity') },
              { key: 'entityId', label: t('المعرّف', 'ID') },
              {
                key: 'details',
                label: t('التفاصيل', 'Details'),
                render: (r) => (
                  <Link className="btn btn--outline btn--sm" to={`/admin/audit-logs/${r.id}`}>
                    {t('عرض', 'View')}
                  </Link>
                ),
              },
            ]}
            rows={rows}
          />
        )}
      </SectionCard>
    </div>
  );
}

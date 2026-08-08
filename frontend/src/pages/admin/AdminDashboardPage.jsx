import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Users, Building2, Layers, ClipboardList, UserPlus, BookOpen } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { useAdminDashboardStats } from '../../features/dashboard/index.js';
import { useLocale } from '../../features/locale/index.js';
import { useAuth } from '../../features/auth/index.js';
import { ROLES } from '../../constants/roles.js';
import { tr } from '../../utils/i18n.js';
import { Button } from '../../components/common/Button.jsx';

export function AdminDashboardPage() {
  const { t } = useTranslation('dashboard');
  const { t: tCommon } = useTranslation('common');
  const { user } = useAuth();

  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const { data, isLoading, isError, error, refetch } = useAdminDashboardStats();
  const isSuperAdmin = Boolean(user?.isGlobal || user?.role === ROLES.SUPER_ADMIN);
  const isInstitutionAdmin =
    Boolean(user?.organizationType === 'INSTITUTION') &&
    (user?.role === ROLES.ADMIN || isSuperAdmin);

  const counts = useMemo(
    () => ({
      users: data?.users ?? 0,
      universities: data?.universities ?? 0,
      cohorts: data?.cohorts ?? 0,
      assessments: data?.assessments ?? 0,
      pendingEnrollments: data?.pending_enrollments ?? 0,
    }),
    [data]
  );

  const activityRows = useMemo(() => {
    const items = data?.recent_activity ?? [];
    return items.map((row) => ({
      id: row.id,
      when: row.created_at ? new Date(row.created_at).toLocaleString(locale) : '—',
      what: `${row.action_type} · ${row.entity_type}`,
      actor: row.actor?.full_name || row.actor?.email || '—',
    }));
  }, [data, locale]);

  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader title={<>{t('admin.title')}</>} description={<>{t('admin.description')}</>} />
      {isLoading ? (
        <LoadingSpinner />
      ) : isError ? (
        <EmptyState
          title={tCommon('errors.generic')}
          description={error?.message || tr(isArabic, 'حاول مرة أخرى.', 'Please try again.')}
          action={
            <Button type="button" variant="primary" onClick={() => refetch()}>
              {tr(isArabic, 'إعادة المحاولة', 'Retry')}
            </Button>
          }
        />
      ) : (
        <>
          {isInstitutionAdmin || isSuperAdmin ? (
            <SectionCard title={tr(isArabic, 'إجراءات سريعة للتدريب المؤسسي', 'Institution training quick actions')}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                {isSuperAdmin ? (
                  <Link className="btn btn--outline btn--sm" to="/admin/institutions">
                    <Building2 size={16} aria-hidden /> {tr(isArabic, 'عرض المؤسسات', 'View institutions')}
                  </Link>
                ) : null}
                <Link className="btn btn--primary btn--sm" to="/admin/training-courses/create">
                  <BookOpen size={16} aria-hidden />{' '}
                  {tr(isArabic, 'إنشاء دورة تدريبية', 'Create training course')}
                </Link>
                <Link className="btn btn--outline btn--sm" to="/admin/training-courses">
                  {tr(isArabic, 'الدورات التدريبية', 'Training courses')}
                </Link>
              </div>
            </SectionCard>
          ) : null}
          <AdminStatsGrid>
            <StatCard
              label={t('admin.stats.activeUsers')}
              value={String(counts.users)}
              hint={t('admin.statsHint')}
              meta={t('admin.statsMeta')}
              icon={Users}
            />
            <StatCard
              label={t('admin.stats.universities')}
              value={String(counts.universities)}
              hint={t('admin.statsHint')}
              meta={t('admin.statsMeta')}
              icon={Building2}
            />
            <StatCard
              label={t('admin.stats.cohorts')}
              value={String(counts.cohorts)}
              hint={t('admin.statsHint')}
              meta={t('admin.statsMeta')}
              icon={Layers}
            />
            <StatCard
              label={t('admin.stats.assessments')}
              value={String(counts.assessments)}
              hint={t('admin.statsHint')}
              meta={t('admin.statsMeta')}
              icon={ClipboardList}
            />
            <StatCard
              label={t('admin.stats.pendingEnrollments')}
              value={String(counts.pendingEnrollments)}
              hint={t('admin.statsHint')}
              meta={t('admin.statsMeta')}
              icon={UserPlus}
            />
          </AdminStatsGrid>
          <SectionCard title={<>{t('admin.recentActivity')}</>}>
            <DataTable
              emptyTitle={tCommon('tenant.emptyForScope')}
              emptyDescription={t('admin.emptyActivity')}
              columns={[
                { key: 'when', label: t('admin.table.time') },
                { key: 'what', label: t('admin.table.event') },
                { key: 'actor', label: t('admin.table.actor') },
              ]}
              rows={activityRows}
            />
          </SectionCard>
        </>
      )}
    </div>
  );
}

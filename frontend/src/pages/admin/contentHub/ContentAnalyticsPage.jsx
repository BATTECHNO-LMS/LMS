import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { BarChart3, BookOpen, Megaphone, Search } from 'lucide-react';
import { AdminPageHeader, AdminStatsGrid, SectionCard } from '../../../components/admin/index.js';
import { StatCard } from '../../../components/common/StatCard.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { DataTable } from '../../../components/tables/DataTable.jsx';
import { useTr } from '../../../features/locale/index.js';
import { fetchAdminHelpAnalytics } from '../../../features/help/index.js';
import {
  fetchAdminAnnouncementAnalytics,
  fetchAdminAnnouncements,
} from '../../../features/announcements/index.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';

export function ContentAnalyticsPage() {
  const t = useTr();

  const helpQuery = useQuery({
    queryKey: ['admin', 'help', 'analytics'],
    queryFn: fetchAdminHelpAnalytics,
  });

  const announcementsQuery = useQuery({
    queryKey: ['admin', 'announcements', 'analytics-summary'],
    queryFn: () => fetchAdminAnnouncements({ page_size: 20 }),
  });

  const announcementItems = announcementsQuery.data?.items ?? [];
  const publishedIds = useMemo(
    () => announcementItems.filter((a) => String(a.status).toUpperCase() === 'PUBLISHED').slice(0, 5).map((a) => a.id),
    [announcementItems]
  );

  const analyticsQueries = useQueries({
    queries: publishedIds.map((id) => ({
      queryKey: ['admin', 'announcements', id, 'analytics'],
      queryFn: () => fetchAdminAnnouncementAnalytics(id),
      enabled: Boolean(id),
    })),
  });

  const announcementAnalyticsRows = publishedIds.map((id, i) => {
    const item = announcementItems.find((a) => a.id === id);
    const data = analyticsQueries[i]?.data;
    return {
      id,
      title: item?.title_ar || id,
      reached: data?.reached_users ?? '—',
      views: data?.total_views ?? '—',
      ack: data?.acknowledged_count ?? '—',
      clicks: data?.clicked_count ?? '—',
    };
  });

  const analytics = helpQuery.data || {};
  const loading = helpQuery.isLoading || announcementsQuery.isLoading;

  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader
        title={t('إحصائيات الاستخدام', 'Usage analytics')}
        description={t(
          'ملخص استخدام دليل المساعدة والإعلانات',
          'Summary of help center and announcement usage'
        )}
      />

      {helpQuery.isError ? <p className="form-error">{getApiErrorMessage(helpQuery.error)}</p> : null}

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          <AdminStatsGrid>
            <StatCard
              label={t('بدء الجولة', 'Tour started')}
              value={String(analytics.onboarding?.started ?? 0)}
              icon={BookOpen}
            />
            <StatCard
              label={t('إكمال الجولة', 'Tour completed')}
              value={String(analytics.onboarding?.completed ?? 0)}
              icon={BarChart3}
            />
            <StatCard
              label={t('تخطي الجولة', 'Tour dismissed')}
              value={String(analytics.onboarding?.dismissed ?? 0)}
              icon={BookOpen}
            />
            <StatCard
              label={t('بحث بلا نتائج', 'Empty searches')}
              value={String(analytics.empty_searches ?? 0)}
              icon={Search}
            />
            <StatCard
              label={t('إعلانات نشطة', 'Active announcements')}
              value={String(announcementItems.filter((a) => String(a.status).toUpperCase() === 'PUBLISHED').length)}
              icon={Megaphone}
            />
          </AdminStatsGrid>

          <SectionCard title={t('أكثر المقالات مشاهدة', 'Top articles')}>
            <DataTable
              emptyTitle={t('لا توجد بيانات', 'No data')}
              emptyDescription=""
              columns={[
                { key: 'title_ar', label: t('العنوان', 'Title') },
                { key: 'slug', label: t('المعرّف', 'Slug') },
                { key: 'view_count', label: t('المشاهدات', 'Views') },
              ]}
              rows={analytics.top_articles || []}
            />
          </SectionCard>

          <SectionCard title={t('فئات تذاكر الدعم', 'Support ticket categories')}>
            <DataTable
              emptyTitle={t('لا توجد بيانات', 'No data')}
              emptyDescription=""
              columns={[
                { key: 'category', label: t('الفئة', 'Category') },
                { key: 'count', label: t('العدد', 'Count') },
              ]}
              rows={analytics.ticket_categories || []}
            />
          </SectionCard>

          <SectionCard title={t('ملخص تحليلات الإعلانات المنشورة', 'Published announcement analytics')}>
            {analyticsQueries.some((q) => q.isLoading) ? (
              <LoadingSpinner />
            ) : (
              <DataTable
                emptyTitle={t('لا توجد إعلانات منشورة', 'No published announcements')}
                emptyDescription=""
                columns={[
                  { key: 'title', label: t('العنوان', 'Title') },
                  { key: 'reached', label: t('الوصول', 'Reached') },
                  { key: 'views', label: t('المشاهدات', 'Views') },
                  { key: 'ack', label: t('الإقرارات', 'Acks') },
                  { key: 'clicks', label: t('النقرات', 'Clicks') },
                ]}
                rows={announcementAnalyticsRows}
              />
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}

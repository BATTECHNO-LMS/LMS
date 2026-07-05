import { useMemo, useState } from 'react';
import { BookOpen, FileText, Layers, ListTree } from 'lucide-react';
import {
  AdminPageHeader,
  AdminFilterBar,
  AdminStatsGrid,
  SectionCard,
  SearchInput,
} from '../../components/admin/index.js';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { useLocale } from '../../features/locale/index.js';
import { useModules } from '../../features/modules/index.js';
import { tr } from '../../utils/i18n.js';

export function ContentManagementPage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const [search, setSearch] = useState('');
  const listParams = useMemo(
    () => ({ page: 1, page_size: 50, search: search.trim() || undefined }),
    [search]
  );
  const { data, isLoading, isError, error, refetch } = useModules(listParams);

  const modules = data?.modules ?? [];
  const published = modules.filter((m) => m.is_published).length;

  const rows = useMemo(
    () =>
      modules.map((m) => ({
        id: m.id,
        title: m.title,
        type: tr(isArabic, 'وحدة تعليمية', 'Learning module'),
        cohort: m.micro_credential?.title ?? '—',
        status: m.is_published
          ? tr(isArabic, 'منشور', 'Published')
          : tr(isArabic, 'مسودة', 'Draft'),
        updated: m.updated_at ? new Date(m.updated_at).toLocaleString(locale) : '—',
      })),
    [modules, isArabic, locale]
  );

  return (
    <div className="page page--dashboard page--admin">
      <AdminPageHeader
        title={tr(isArabic, 'المحتوى', 'Content')}
        description={tr(
          isArabic,
          'وحدات التعلم المرتبطة بالشهادات المصغّرة من قاعدة البيانات.',
          'Learning modules linked to micro-credentials from the database.'
        )}
      />
      <AdminFilterBar>
        <SearchInput
          placeholder={tr(isArabic, 'بحث بالعنوان', 'Search by title')}
          aria-label={tr(isArabic, 'بحث', 'Search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </AdminFilterBar>
      {isLoading ? (
        <LoadingSpinner />
      ) : isError ? (
        <EmptyState
          title={tr(isArabic, 'تعذّر تحميل المحتوى', 'Failed to load content')}
          description={error?.message}
          actionLabel={tr(isArabic, 'إعادة المحاولة', 'Retry')}
          onAction={() => refetch()}
        />
      ) : (
        <>
          <AdminStatsGrid>
            <StatCard
              label={tr(isArabic, 'إجمالي الوحدات', 'Total modules')}
              value={String(modules.length)}
              icon={BookOpen}
            />
            <StatCard
              label={tr(isArabic, 'وحدات منشورة', 'Published modules')}
              value={String(published)}
              icon={FileText}
            />
            <StatCard
              label={tr(isArabic, 'مسودات', 'Drafts')}
              value={String(modules.length - published)}
              icon={Layers}
            />
            <StatCard
              label={tr(isArabic, 'عناصر محتوى', 'Content items')}
              value={String(modules.reduce((s, m) => s + (m.contents_count ?? 0), 0))}
              icon={ListTree}
            />
          </AdminStatsGrid>
          <SectionCard title={tr(isArabic, 'قائمة المحتوى', 'Content list')}>
            <DataTable
              emptyTitle={tr(isArabic, 'لا توجد وحدات', 'No modules')}
              emptyDescription={tr(
                isArabic,
                'أنشئ وحدات ضمن الشهادات المصغّرة لعرضها هنا.',
                'Create modules under micro-credentials to see them here.'
              )}
              columns={[
                { key: 'title', label: tr(isArabic, 'العنوان', 'Title') },
                { key: 'type', label: tr(isArabic, 'النوع', 'Type') },
                { key: 'cohort', label: tr(isArabic, 'الشهادة المصغّرة', 'Micro-credential') },
                { key: 'status', label: tr(isArabic, 'الحالة', 'Status') },
                { key: 'updated', label: tr(isArabic, 'آخر تحديث', 'Last update') },
              ]}
              rows={rows}
            />
          </SectionCard>
        </>
      )}
    </div>
  );
}

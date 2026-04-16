import { useMemo } from 'react';
import { BarChart3, Award, TrendingUp, BookMarked } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar.jsx';
import { SearchInput } from '../../components/admin/SearchInput.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { GradeSummaryCard } from '../../components/grades/GradeSummaryCard.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { useGrades } from '../../features/grades/index.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';

export function StudentGradesPage() {
  const { data: gradesPayload, isLoading, isError, error } = useGrades({}, { staleTime: 30_000 });
  const rows = useMemo(
    () =>
      (gradesPayload?.grades ?? []).map((g) => ({
        id: g.id,
        course: g.assessment?.cohort?.title ?? '—',
        item: g.assessment?.title ?? '—',
        score: g.score != null ? String(g.score) : '—',
        weight: g.assessment?.weight != null ? `${g.assessment.weight}%` : '—',
      })),
    [gradesPayload]
  );
  const { gpaPct, highestPct, courseCount } = useMemo(() => {
    const scores = rows.map((r) => Number(r.score)).filter((n) => !Number.isNaN(n));
    if (!scores.length) {
      return { gpaPct: null, highestPct: null, courseCount: 0 };
    }
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const hi = Math.max(...scores);
    const courses = new Set(rows.map((r) => r.course)).size;
    return { gpaPct: Math.round(avg), highestPct: Math.round(hi), courseCount: courses };
  }, [rows]);

  const gpaLabel = gpaPct != null ? `${gpaPct}%` : '—';
  const highLabel = highestPct != null ? `${highestPct}%` : '—';
  const loadError = isError ? getApiErrorMessage(error, 'تعذر تحميل الدرجات') : '';

  return (
    <div className="page page--dashboard page--student">
      <AdminPageHeader
        title="الدرجات"
        description="درجاتك المنشورة فقط — لا تُعرض درجات المتعلمين الآخرين."
      />
      <div className="grade-summary-grid">
        <GradeSummaryCard label="المعدل التقديري" value={gpaLabel} hint="وفق العناصر المعتمدة" icon={BarChart3} />
        <GradeSummaryCard label="مساقات بدرجات" value={String(courseCount)} icon={BookMarked} />
        <GradeSummaryCard label="أعلى درجة" value={highLabel} icon={Award} />
        <GradeSummaryCard label="الاتجاه" value="مستقر" icon={TrendingUp} />
      </div>
      <AdminFilterBar>
        <SearchInput placeholder="بحث بالمساق" aria-label="بحث" />
      </AdminFilterBar>
      <SectionCard title="درجاتي">
        {isLoading ? <LoadingSpinner /> : null}
        {loadError ? <p className="crud-muted">{loadError}</p> : null}
        {!isLoading ? (
          <DataTable
            emptyTitle="لا توجد درجات منشورة بعد"
            emptyDescription="ستظهر الدرجات المعتمدة من المدرّس هنا."
            columns={[
              { key: 'course', label: 'المساق / الشهادة' },
              { key: 'item', label: 'عنصر التقييم' },
              { key: 'score', label: 'الدرجة' },
              { key: 'weight', label: 'الوزن' },
            ]}
            rows={loadError ? [] : rows}
          />
        ) : null}
      </SectionCard>
    </div>
  );
}

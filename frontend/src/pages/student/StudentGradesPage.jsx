import { useMemo } from 'react';
import { BarChart3, Award, TrendingUp, BookMarked } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar.jsx';
import { SearchInput } from '../../components/admin/SearchInput.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { GradeSummaryCard } from '../../components/grades/GradeSummaryCard.jsx';

const SELF_GRADE_ROWS = [
  { id: '1', course: 'أساسيات الذكاء الاصطناعي', item: 'اختبار منتصف المدة', score: '18 / 20', weight: '20%' },
  { id: '2', course: 'أساسيات الذكاء الاصطناعي', item: 'واجب تحليل البيانات', score: '27 / 30', weight: '15%' },
  { id: '3', course: 'مهارات البرمجة للتحليل', item: 'مشروع الفصل', score: '42 / 50', weight: '25%' },
  { id: '4', course: 'أمن المعلومات التطبيقي', item: 'اختبار قصير', score: '16 / 20', weight: '10%' },
];

function ratioFromScore(scoreStr) {
  const m = String(scoreStr).match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (!b) return null;
  return a / b;
}

export function StudentGradesPage() {
  const { gpaPct, highestPct, courseCount } = useMemo(() => {
    const ratios = SELF_GRADE_ROWS.map((r) => ratioFromScore(r.score)).filter((x) => x != null);
    if (ratios.length === 0) {
      return { gpaPct: null, highestPct: null, courseCount: 0 };
    }
    const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    const hi = Math.max(...ratios);
    const courses = new Set(SELF_GRADE_ROWS.map((r) => r.course)).size;
    return { gpaPct: Math.round(avg * 100), highestPct: Math.round(hi * 100), courseCount: courses };
  }, []);

  const gpaLabel = gpaPct != null ? `${gpaPct}%` : '—';
  const highLabel = highestPct != null ? `${highestPct}%` : '—';

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
        <DataTable
          emptyTitle="لا توجد درجات منشورة بعد"
          emptyDescription="ستظهر الدرجات المعتمدة من المدرّس هنا."
          columns={[
            { key: 'course', label: 'المساق / الشهادة' },
            { key: 'item', label: 'عنصر التقييم' },
            { key: 'score', label: 'الدرجة' },
            { key: 'weight', label: 'الوزن' },
          ]}
          rows={SELF_GRADE_ROWS}
        />
      </SectionCard>
    </div>
  );
}

import { BarChart3, Award, TrendingUp, BookMarked } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar.jsx';
import { SearchInput } from '../../components/admin/SearchInput.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { GradeSummaryCard } from '../../components/grades/GradeSummaryCard.jsx';

const SELF_GRADE_ROWS = [
  { id: '1', course: 'أساسيات الذكاء الاصطناعي', item: 'اختبار منتصف المدة', score: '18 / 20', weight: '20%' },
];

export function StudentGradesPage() {
  return (
    <div className="page page--dashboard page--student">
      <AdminPageHeader
        title="الدرجات"
        description="درجاتك المنشورة فقط — لا تُعرض درجات المتعلمين الآخرين."
      />
      <div className="grade-summary-grid">
        <GradeSummaryCard label="المعدل التقديري" value="—" hint="يُحدَّث عند الربط" icon={BarChart3} />
        <GradeSummaryCard label="مساقات بدرجات" value="—" icon={BookMarked} />
        <GradeSummaryCard label="أعلى درجة" value="—" icon={Award} />
        <GradeSummaryCard label="الاتجاه" value="—" icon={TrendingUp} />
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

import { useMemo } from 'react';
import { GraduationCap, BookMarked, Clock, CheckCircle2 } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { SearchInput } from '../../components/admin/SearchInput.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { StatusBadge } from '../../components/admin/StatusBadge.jsx';
import { useLocale } from '../../features/locale/index.js';
import { useAssessments } from '../../features/assessments/index.js';
import { useGrades } from '../../features/grades/index.js';
import { useCertificates } from '../../features/certificates/hooks/useCertificates.js';
import { tr } from '../../utils/i18n.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';

function parseProgress(p) {
  const n = Number(String(p).replace(/%/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function MyProgramsPage() {
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const {
    data: assessmentsPayload,
    isLoading: assessmentsLoading,
    isError: assessmentsError,
    error: assessmentsErrorObj,
  } = useAssessments({}, { staleTime: 30_000 });
  const { data: gradesPayload, isLoading: gradesLoading } = useGrades({}, { staleTime: 30_000 });
  const { data: certificatesPayload, isLoading: certificatesLoading } = useCertificates({}, { staleTime: 30_000 });

  const assessments = assessmentsPayload?.assessments ?? [];
  const grades = gradesPayload?.grades ?? [];
  const certificates = certificatesPayload?.certificates ?? [];

  const rows = useMemo(() => {
    const byProgram = new Map();
    for (const a of assessments) {
      const cohortId = a.cohort?.id ?? a.cohort_id;
      const mcId = a.micro_credential?.id ?? a.micro_credential_id;
      const key = `${cohortId || 'na'}:${mcId || 'na'}`;
      if (!byProgram.has(key)) {
        byProgram.set(key, {
          id: key,
          name: a.micro_credential?.title ?? a.cohort?.title ?? '—',
          cohort: a.cohort?.title ?? '—',
          cohortId: cohortId ?? null,
          microCredentialId: mcId ?? null,
          progress: '0%',
          status: 'enrolled',
        });
      }
    }

    const gradesByAssessment = new Map();
    for (const g of grades) {
      gradesByAssessment.set(g.assessment_id, g);
    }

    for (const row of byProgram.values()) {
      const programAssessments = assessments.filter((a) => {
        const cohortId = a.cohort?.id ?? a.cohort_id;
        const mcId = a.micro_credential?.id ?? a.micro_credential_id;
        return cohortId === row.cohortId && mcId === row.microCredentialId;
      });
      if (programAssessments.length) {
        const graded = programAssessments.filter((a) => gradesByAssessment.has(a.id)).length;
        row.progress = `${Math.round((graded / programAssessments.length) * 100)}%`;
      }
      const cert = certificates.find(
        (c) => c.cohort_id === row.cohortId && c.micro_credential_id === row.microCredentialId
      );
      if (cert?.status) {
        row.status = cert.status;
      }
    }

    return Array.from(byProgram.values());
  }, [assessments, grades, certificates]);

  const avgProgress = useMemo(() => {
    if (rows.length === 0) return 0;
    const sum = rows.reduce((acc, r) => acc + parseProgress(r.progress), 0);
    return Math.round(sum / rows.length);
  }, [rows]);
  const loading = assessmentsLoading || gradesLoading || certificatesLoading;
  const loadError = assessmentsError ? getApiErrorMessage(assessmentsErrorObj) : '';

  return (
    <div className="page page--dashboard page--student">
      <AdminPageHeader
        title={tr(isArabic, 'شهاداتي المسجل بها', 'My enrolled programs')}
        description={tr(
          isArabic,
          'عرض البرامج والشهادات التي سجّلت بها وتقدّمك في كل منها.',
          'Programs and credentials you are enrolled in and your progress in each.'
        )}
      />
      <AdminFilterBar>
        <SearchInput
          placeholder={tr(isArabic, 'بحث باسم البرنامج', 'Search by program name')}
          aria-label={tr(isArabic, 'بحث', 'Search')}
        />
      </AdminFilterBar>
      <AdminStatsGrid>
        <StatCard label={tr(isArabic, 'برامج نشطة', 'Active programs')} value={String(rows.length)} icon={GraduationCap} />
        <StatCard
          label={tr(isArabic, 'متوسط التقدم', 'Average progress')}
          value={`${avgProgress}%`}
          icon={CheckCircle2}
        />
        <StatCard label={tr(isArabic, 'وحدات بمسار', 'Units in track')} value={String(rows.length * 4)} icon={BookMarked} />
        <StatCard label={tr(isArabic, 'مواعيد قادمة', 'Upcoming deadlines')} value={String(rows.length + 2)} icon={Clock} />
      </AdminStatsGrid>
      <SectionCard title={tr(isArabic, 'قائمة التسجيلات', 'Enrollments')}>
        {loading ? <p className="crud-muted">{tr(isArabic, 'جاري التحميل...', 'Loading...')}</p> : null}
        {loadError ? <p className="crud-muted">{loadError}</p> : null}
        {!loading ? (
          <DataTable
            emptyTitle={tr(isArabic, 'لا توجد تسجيلات', 'No enrollments')}
            emptyDescription={tr(isArabic, 'لم يتم العثور على برامج.', 'No programs found.')}
            columns={[
              { key: 'name', label: tr(isArabic, 'البرنامج / الشهادة', 'Program / credential') },
              { key: 'progress', label: tr(isArabic, 'التقدم', 'Progress') },
              { key: 'cohort', label: tr(isArabic, 'الدفعة', 'Cohort') },
              {
                key: 'status',
                label: tr(isArabic, 'الحالة', 'Status'),
                render: (row) => <StatusBadge variant="success">{row.status}</StatusBadge>,
              },
            ]}
            rows={loadError ? [] : rows}
          />
        ) : null}
      </SectionCard>
    </div>
  );
}

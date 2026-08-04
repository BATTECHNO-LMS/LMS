import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '../../../../components/common/Button.jsx';
import { LoadingSpinner } from '../../../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../../../components/common/EmptyState.jsx';
import { StatusBadge } from '../../../../components/admin/StatusBadge.jsx';
import {
  OFFICIAL_REPORT_TYPES,
  generateOfficialReport,
  getLatestOfficialReport,
  listOfficialReports,
} from '../../training.service.js';
import { getApiErrorMessage } from '../../../../services/apiHelpers.js';
import { ReportExportActions } from './ReportExportActions.jsx';

const CHART_COLORS = ['#132d4a', '#1e5a8a', '#c9a227', '#2f6b4f', '#b76e1f', '#a33b3b'];

function Kpi({ label, value }) {
  return (
    <div className="training-report-kpi">
      <span className="training-report-kpi__label">{label}</span>
      <strong className="training-report-kpi__value">{value ?? 'غير متوفر'}</strong>
    </div>
  );
}

function fmtPct(v) {
  return v == null ? 'غير متوفر' : `${v}%`;
}

/**
 * Branded interactive report hub for a training program.
 * Renders backend snapshot data only (no client-side metric recalculation).
 */
export function CourseReportDashboard({ programId, cohortId, canGenerate = false }) {
  const [reportType, setReportType] = useState('COURSE');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [report, setReport] = useState(null);
  const [history, setHistory] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const managerTypes = useMemo(
    () => OFFICIAL_REPORT_TYPES.filter((t) => t.type !== 'INDIVIDUAL'),
    []
  );

  const load = useCallback(async () => {
    if (!programId) return;
    setLoading(true);
    setError('');
    setNotFound(false);
    try {
      const [latest, hist] = await Promise.all([
        getLatestOfficialReport(programId, { reportType, cohortId }),
        listOfficialReports(programId, { reportType, cohortId }),
      ]);
      setReport(latest);
      setHistory(hist || []);
    } catch (err) {
      const code = err?.response?.data?.code || err?.code;
      if (code === 'REPORT_NOT_FOUND' || code === 'COURSE_REPORT_NOT_FOUND') {
        setNotFound(true);
        setReport(null);
      } else {
        setError(getApiErrorMessage(err, 'تعذر تحميل التقرير.'));
      }
    } finally {
      setLoading(false);
    }
  }, [programId, cohortId, reportType]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleGenerate() {
    setGenerating(true);
    setError('');
    try {
      const data = await generateOfficialReport(programId, {
        reportType,
        cohortId: cohortId || undefined,
      });
      setReport(data);
      setNotFound(false);
      const hist = await listOfficialReports(programId, { reportType, cohortId });
      setHistory(hist || []);
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذر إنشاء التقرير.'));
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <LoadingSpinner label="جاري تجهيز التقرير..." />;

  if (notFound) {
    return (
      <div className="training-report-hub" dir="rtl">
        <ReportTypeTabs types={managerTypes} active={reportType} onChange={setReportType} />
        <EmptyState
          title="لم يُنشأ هذا التقرير بعد"
          description="يتم توليد التقارير من بيانات الإكمال المعتمدة في الخادم."
          action={
            canGenerate ? (
              <Button type="button" variant="primary" loading={generating} onClick={handleGenerate}>
                توليد التقرير الآن
              </Button>
            ) : null
          }
        />
      </div>
    );
  }

  if (error && !report) {
    return (
      <div className="training-report-hub" dir="rtl">
        <p className="form-field__error" role="alert">
          {error}
        </p>
        <Button type="button" variant="outline" onClick={load}>
          إعادة المحاولة
        </Button>
      </div>
    );
  }

  if (!report) return null;
  const snap = report.snapshot || {};
  const meta = snap.meta || {};
  const exec = snap.executiveSummary || {};
  const nps = snap.nps || snap.evaluation?.nps || {};
  const funnel = snap.enrollmentFunnel || [];
  const isStale = report.status === 'STALE' || (!report.isLatest && report.isLatest != null);

  const completionPie = [
    { name: 'مكتمل', value: snap.completion?.completed ?? snap.counts?.completed ?? 0 },
    { name: 'غير مكتمل', value: snap.completion?.notCompleted ?? snap.counts?.notCompleted ?? 0 },
    { name: 'منسحب', value: snap.completion?.withdrawn ?? snap.counts?.withdrawn ?? 0 },
  ].filter((d) => d.value > 0);

  const prePostBars = [
    { name: 'قبلي', value: exec.preTestAverage ?? snap.learningImpact?.averagePre ?? snap.preTest?.average },
    { name: 'بعدي', value: exec.postTestAverage ?? snap.learningImpact?.averagePost ?? snap.postTest?.average },
  ].filter((d) => d.value != null);

  return (
    <div className="training-report-hub" dir="rtl">
      <ReportTypeTabs types={managerTypes} active={reportType} onChange={setReportType} />

      <header className="training-report-hub__header">
        <div>
          <p className="training-report-hub__eyebrow">{meta.institutionName || 'BATTECHNO LMS'}</p>
          <h3 className="training-report-hub__title">{report.reportTitle || meta.reportTitle || 'تقرير الدورة'}</h3>
          <p className="training-report-hub__course">{meta.courseName || snap.courseInfo?.name || snap.programTitle}</p>
          <div className="training-report-hub__meta-row">
            {report.referenceCode ? <StatusBadge variant="info">المرجع: {report.referenceCode}</StatusBadge> : null}
            <StatusBadge variant={isStale ? 'warning' : 'success'}>
              {isStale ? 'بيانات أحدث متاحة — إصدار سابق' : `الإصدار ${report.version}`}
            </StatusBadge>
            <span className="training-report-hub__freshness">
              آخر توليد: {report.generatedAt ? new Date(report.generatedAt).toLocaleString('ar') : '—'}
            </span>
          </div>
        </div>
        <div className="training-report-hub__actions">
          <Button type="button" variant="outline" size="sm" className="training-report-hub__filters-toggle" onClick={() => setFiltersOpen((v) => !v)}>
            الفلاتر
          </Button>
          {canGenerate ? (
            <Button type="button" variant="primary" size="sm" loading={generating} onClick={handleGenerate}>
              إعادة التوليد
            </Button>
          ) : null}
          {!report.legacy ? <ReportExportActions reportId={report.id} /> : null}
        </div>
      </header>

      {filtersOpen ? (
        <div className="training-report-hub__filters">
          <p>الدفعة الحالية: {cohortId || 'كل الدفعات'}</p>
          <p className="muted">فلاتر الفرع/المدرب تُطبَّق عند توليد التقارير المتخصصة من الخادم.</p>
        </div>
      ) : null}

      {error ? (
        <p className="form-field__error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="training-report-kpi-grid" aria-label="مؤشرات رئيسية">
        <Kpi label="المتدربون" value={exec.traineeCount ?? snap.counts?.total} />
        <Kpi label="نسبة الإكمال" value={fmtPct(exec.completionRate ?? snap.completionRate)} />
        <Kpi label="متوسط الحضور" value={fmtPct(exec.averageAttendance ?? snap.attendance?.average ?? snap.averageAttendancePct)} />
        <Kpi label="NPS" value={exec.nps ?? nps.index} />
        <Kpi label="متوسط القبلي" value={exec.preTestAverage ?? snap.preTest?.average} />
        <Kpi label="متوسط البعدي" value={exec.postTestAverage ?? snap.postTest?.average} />
        <Kpi label="متوسط التحسن (ن.م)" value={exec.averageImprovementPp ?? snap.learningImpact?.averagePp} />
        <Kpi label="معدل الاستجابة للتقييم" value={fmtPct(exec.evaluationResponseRate ?? snap.evaluation?.responseRate)} />
      </section>

      <div className="training-report-charts">
        {completionPie.length ? (
          <div className="training-report-chart-card">
            <h4>توزيع الإكمال</h4>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={completionPie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                  {completionPie.map((entry, i) => (
                    <Cell key={entry.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : null}

        {prePostBars.length ? (
          <div className="training-report-chart-card">
            <h4>مقارنة القبلي / البعدي</h4>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={prePostBars}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="value" fill="#1e5a8a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : null}

        {funnel.length ? (
          <div className="training-report-chart-card training-report-chart-card--wide">
            <h4>قمع التسجيل</h4>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={funnel}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#132d4a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </div>

      {Array.isArray(snap.recommendations) && snap.recommendations.length ? (
        <section className="training-report-section">
          <h4>التوصيات</h4>
          <div className="training-report-table-wrap">
            <table className="training-report-table">
              <thead>
                <tr>
                  <th>الملاحظة</th>
                  <th>الدليل</th>
                  <th>الأولوية</th>
                  <th>الإجراء</th>
                </tr>
              </thead>
              <tbody>
                {snap.recommendations.map((r, idx) => (
                  <tr key={idx}>
                    <td>{typeof r === 'string' ? r : r.finding}</td>
                    <td>{typeof r === 'string' ? '—' : r.evidence}</td>
                    <td>{typeof r === 'string' ? '—' : r.priority}</td>
                    <td>{typeof r === 'string' ? '—' : r.recommendedAction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {history.length > 1 ? (
        <section className="training-report-section">
          <h4>سجل الإصدارات</h4>
          <ul className="training-report-history">
            {history.map((h) => (
              <li key={h.id}>
                <span>v{h.version}</span>
                <span>{h.referenceCode || h.id.slice(0, 8)}</span>
                <span>{h.generatedAt ? new Date(h.generatedAt).toLocaleString('ar') : '—'}</span>
                <StatusBadge variant={h.isLatest ? 'success' : 'muted'}>{h.status}</StatusBadge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function ReportTypeTabs({ types, active, onChange }) {
  return (
    <div className="training-report-tabs" role="tablist" aria-label="أنواع التقارير">
      {types.map((t) => (
        <button
          key={t.type}
          type="button"
          role="tab"
          aria-selected={active === t.type}
          className={`training-report-tabs__btn${active === t.type ? ' is-active' : ''}`}
          onClick={() => onChange(t.type)}
        >
          {t.title}
        </button>
      ))}
    </div>
  );
}

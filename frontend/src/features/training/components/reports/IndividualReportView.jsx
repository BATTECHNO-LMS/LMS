import { useCallback, useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
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
  generateEnrollmentOfficialReport,
  getEnrollmentOfficialReport,
  getIndividualReport,
  generateIndividualReport,
} from '../../training.service.js';
import { getApiErrorMessage } from '../../../../services/apiHelpers.js';
import { ReportExportActions } from './ReportExportActions.jsx';

function Kpi({ label, value, tone }) {
  return (
    <div className={`training-report-kpi${tone ? ` training-report-kpi--${tone}` : ''}`}>
      <span className="training-report-kpi__label">{label}</span>
      <strong className="training-report-kpi__value">{value ?? 'غير متوفر'}</strong>
    </div>
  );
}

/**
 * Detailed individual trainee report view from backend snapshot.
 */
export function IndividualReportView({ enrollmentId, canGenerate = false }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [report, setReport] = useState(null);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    if (!enrollmentId) return;
    setLoading(true);
    setError('');
    setNotFound(false);
    try {
      let data;
      try {
        data = await getEnrollmentOfficialReport(enrollmentId);
      } catch {
        data = await getIndividualReport(enrollmentId);
      }
      setReport(data);
    } catch (err) {
      const code = err?.response?.data?.code || err?.code;
      if (code === 'REPORT_NOT_FOUND' || code === 'INDIVIDUAL_REPORT_NOT_FOUND') {
        setNotFound(true);
        setReport(null);
      } else {
        setError(getApiErrorMessage(err, 'تعذر تحميل التقرير الفردي.'));
      }
    } finally {
      setLoading(false);
    }
  }, [enrollmentId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleGenerate() {
    setGenerating(true);
    setError('');
    try {
      let data;
      try {
        data = await generateEnrollmentOfficialReport(enrollmentId);
      } catch {
        data = await generateIndividualReport(enrollmentId);
      }
      setReport(data);
      setNotFound(false);
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذر توليد التقرير الفردي.'));
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <LoadingSpinner label="جاري تجهيز التقرير الفردي..." />;

  if (notFound) {
    return (
      <EmptyState
        title="لا يوجد تقرير فردي بعد"
        description="يُنشأ التقرير من بيانات الإكمال والحضور والاختبارات المعتمدة في الخادم."
        action={
          canGenerate ? (
            <Button type="button" variant="primary" loading={generating} onClick={handleGenerate}>
              توليد التقرير الآن
            </Button>
          ) : null
        }
      />
    );
  }

  if (error && !report) {
    return (
      <div>
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
  const id = snap.identity || {};
  const exec = snap.executiveSummary || {};
  const improvement = snap.learningImprovement || snap.learning || {};
  const chartData = [
    { name: 'قبلي', value: improvement.preTestScore ?? exec.preTestScore ?? snap.learning?.preTestScore },
    { name: 'بعدي', value: improvement.postTestScore ?? exec.postTestScore ?? snap.learning?.postTestScore },
  ].filter((d) => d.value != null);

  return (
    <div className="training-report-hub individual-report" dir="rtl">
      <header className="training-report-hub__header">
        <div>
          <p className="training-report-hub__eyebrow">{id.institution || snap.meta?.institutionName}</p>
          <h3 className="training-report-hub__title">التقرير الفردي لنتائج المتدرب</h3>
          <p className="training-report-hub__course">{id.fullName || 'متدرب'} — {id.course || snap.meta?.courseName}</p>
          <div className="training-report-hub__meta-row">
            {report.referenceCode ? <StatusBadge variant="info">{report.referenceCode}</StatusBadge> : null}
            <StatusBadge variant="success">الإصدار {report.version}</StatusBadge>
          </div>
        </div>
        <div className="training-report-hub__actions">
          {canGenerate ? (
            <Button type="button" variant="outline" size="sm" loading={generating} onClick={handleGenerate}>
              إعادة التوليد
            </Button>
          ) : null}
          {!report.legacy && report.id ? <ReportExportActions reportId={report.id} /> : null}
        </div>
      </header>

      <section className="training-report-kpi-grid">
        <Kpi label="الحالة النهائية" value={exec.finalStatus || snap.completion?.status} tone="navy" />
        <Kpi label="نسبة الحضور" value={exec.attendancePct != null ? `${exec.attendancePct}%` : snap.attendance?.attendancePctLabel} />
        <Kpi label="الساعات" value={`${exec.hoursCompleted ?? snap.attendance?.hoursCompleted ?? '—'} / ${exec.hoursRequired ?? snap.attendance?.hoursRequired ?? '—'}`} />
        <Kpi label="قبلي" value={exec.preTestScore != null ? `${exec.preTestScore}%` : null} />
        <Kpi label="بعدي" value={exec.postTestScore != null ? `${exec.postTestScore}%` : null} />
        <Kpi
          label="التحسن (ن.م)"
          value={exec.improvementPp ?? improvement.percentagePointDifference ?? improvement.improvement}
          tone={(exec.improvementPp ?? improvement.percentagePointDifference) < 0 ? 'danger' : 'success'}
        />
        <Kpi label="التقييم النهائي" value={exec.evaluationSubmitted || snap.evaluation?.submitted ? 'مكتمل' : 'غير مكتمل'} />
        <Kpi label="الشهادة" value={exec.certificateStatus || snap.certificate?.status || (snap.certificate?.issued ? 'صادرة' : 'غير صادرة')} />
      </section>

      {chartData.length ? (
        <div className="training-report-chart-card">
          <h4>مقارنة الاختبارين</h4>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="value" fill="#1e5a8a" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          {improvement.note ? <p className="muted">{improvement.note}</p> : null}
        </div>
      ) : null}

      <section className="training-report-section">
        <h4>هوية المتدرب</h4>
        <div className="training-report-table-wrap">
          <table className="training-report-table">
            <tbody>
              {[
                ['الاسم', id.fullName],
                ['المؤسسة', id.institution],
                ['الفرع', id.branch],
                ['الدفعة', id.cohort],
                ['حالة التسجيل', id.enrollmentStatus],
                ['بداية الدورة', id.courseStart],
                ['نهاية الدورة', id.courseEnd],
              ].map(([k, v]) => (
                <tr key={k}>
                  <th>{k}</th>
                  <td>{v ?? 'غير متوفر'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {snap.requirements?.length ? (
        <section className="training-report-section">
          <h4>متطلبات الإكمال</h4>
          <ul className="training-report-req-list">
            {snap.requirements.map((r) => (
              <li key={r.code}>
                <span>{r.title}</span>
                <StatusBadge variant={r.state === 'completed' ? 'success' : r.state === 'not_required' ? 'muted' : 'warning'}>
                  {r.label}
                </StatusBadge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {snap.attendance?.sessions?.length ? (
        <section className="training-report-section">
          <h4>تفاصيل الحضور</h4>
          <div className="training-report-table-wrap">
            <table className="training-report-table">
              <thead>
                <tr>
                  <th>الجلسة</th>
                  <th>التاريخ</th>
                  <th>المدة</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {snap.attendance.sessions.map((s) => (
                  <tr key={s.sessionId}>
                    <td>{s.title}</td>
                    <td>{s.dateLabel || '—'}</td>
                    <td>{s.durationHours ?? '—'}</td>
                    <td>{s.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {snap.recommendation || snap.summary ? (
        <section className="training-report-section">
          <h4>التوصية</h4>
          <div className="training-report-callout">{snap.recommendation || snap.summary}</div>
        </section>
      ) : null}

      {snap.certificate?.verificationUrl || snap.certificate?.verificationCode ? (
        <section className="training-report-section">
          <h4>الشهادة</h4>
          <p>رقم الشهادة: {snap.certificate.certificateNumber || 'غير متوفر'}</p>
          <p>رمز التحقق: {snap.certificate.verificationCode || 'غير متوفر'}</p>
        </section>
      ) : null}
    </div>
  );
}

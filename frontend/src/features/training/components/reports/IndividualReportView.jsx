import { useCallback, useEffect, useState } from 'react';
import { Button } from '../../../../components/common/Button.jsx';
import { LoadingSpinner } from '../../../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../../../components/common/EmptyState.jsx';
import { StatusBadge } from '../../../../components/admin/StatusBadge.jsx';
import { getIndividualReport, generateIndividualReport } from '../../training.service.js';
import { getApiErrorMessage } from '../../../../services/apiHelpers.js';
import { ReportExportActions } from './ReportExportActions.jsx';

/**
 * Trainee-facing / manager-facing view of the versioned individual completion report.
 * @param {{ enrollmentId: string, canGenerate?: boolean }} props
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
      const data = await getIndividualReport(enrollmentId);
      setReport(data);
    } catch (err) {
      const code = err?.response?.data?.code || err?.code;
      if (code === 'INDIVIDUAL_REPORT_NOT_FOUND') {
        setNotFound(true);
      } else {
        setError(getApiErrorMessage(err, 'تعذر تحميل التقرير الفردي.'));
      }
      setReport(null);
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
      const data = await generateIndividualReport(enrollmentId);
      setReport(data);
      setNotFound(false);
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذر توليد التقرير الفردي.'));
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return <LoadingSpinner label="جاري تحميل التقرير الفردي" />;
  }

  if (notFound) {
    return (
      <EmptyState
        title="لا يوجد تقرير فردي بعد"
        description="يتم توليد التقرير الفردي تلقائيًا عند اعتماد إكمال المتدرب، أو يمكن توليده يدويًا."
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

  if (error) {
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

  return (
    <div className="individual-report" dir="rtl">
      <div className="individual-report__head">
        <div>
          <h3 className="individual-report__name">{snap.identity?.fullName || '—'}</h3>
          <p className="individual-report__sub">
            {snap.identity?.programTitle || '—'} — {snap.identity?.cohortName || '—'}
          </p>
        </div>
        <div className="individual-report__actions">
          {canGenerate ? (
            <Button type="button" variant="outline" size="sm" loading={generating} onClick={handleGenerate}>
              إعادة توليد
            </Button>
          ) : null}
          <ReportExportActions data={report} filenameBase={`individual-report-${enrollmentId}`} title="التقرير الفردي" />
        </div>
      </div>

      {report.summary || snap.summary ? (
        <p className="individual-report__summary">{report.summary || snap.summary}</p>
      ) : null}

      <div className="eval-metrics-grid">
        <div className="eval-metric-card">
          <div className="eval-metric-card__text">
            <p className="eval-metric-card__label">نسبة الحضور</p>
            <p className="eval-metric-card__value">
              {snap.attendance?.attendancePct != null ? `${snap.attendance.attendancePct}%` : '—'}
            </p>
          </div>
        </div>
        <div className="eval-metric-card">
          <div className="eval-metric-card__text">
            <p className="eval-metric-card__label">الساعات</p>
            <p className="eval-metric-card__value">
              {snap.attendance?.hoursCompleted ?? 0}
              {snap.attendance?.hoursRequired != null ? ` / ${snap.attendance.hoursRequired}` : ''}
            </p>
          </div>
        </div>
        <div className="eval-metric-card">
          <div className="eval-metric-card__text">
            <p className="eval-metric-card__label">الاختبار القبلي</p>
            <p className="eval-metric-card__value">
              {snap.learning?.preTestScore != null ? `${snap.learning.preTestScore}%` : '—'}
            </p>
          </div>
        </div>
        <div className="eval-metric-card">
          <div className="eval-metric-card__text">
            <p className="eval-metric-card__label">الاختبار البعدي</p>
            <p className="eval-metric-card__value">
              {snap.learning?.postTestScore != null ? `${snap.learning.postTestScore}%` : '—'}
            </p>
          </div>
        </div>
        <div className="eval-metric-card">
          <div className="eval-metric-card__text">
            <p className="eval-metric-card__label">المهمات</p>
            <p className="eval-metric-card__value">
              {snap.tasks?.completedCount ?? 0} / {snap.tasks?.requiredCount ?? 0}
            </p>
          </div>
        </div>
        <div className="eval-metric-card">
          <div className="eval-metric-card__text">
            <p className="eval-metric-card__label">التقييم النهائي</p>
            <p className="eval-metric-card__value">{snap.evaluation?.submitted ? 'أُرسل' : 'لم يُرسل'}</p>
          </div>
        </div>
      </div>

      <dl className="detail-list">
        <div className="detail-list__row">
          <dt>حالة الإكمال</dt>
          <dd>
            <StatusBadge variant={snap.completion?.status === 'COMPLETED' ? 'success' : 'muted'}>
              {snap.completion?.status || '—'}
            </StatusBadge>
          </dd>
        </div>
        <div className="detail-list__row">
          <dt>الشهادة</dt>
          <dd>{snap.certificate?.issued ? `صادرة — ${snap.certificate.certificateNumber}` : 'غير صادرة'}</dd>
        </div>
        <div className="detail-list__row">
          <dt>تاريخ التوليد</dt>
          <dd>{report.generatedAt ? String(report.generatedAt).slice(0, 16).replace('T', ' ') : '—'}</dd>
        </div>
      </dl>
    </div>
  );
}

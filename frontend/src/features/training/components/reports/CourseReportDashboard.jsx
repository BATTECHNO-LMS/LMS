import { useCallback, useEffect, useState } from 'react';
import { Button } from '../../../../components/common/Button.jsx';
import { LoadingSpinner } from '../../../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../../../components/common/EmptyState.jsx';
import { StatusBadge } from '../../../../components/admin/StatusBadge.jsx';
import { getCourseReport, generateCourseReport } from '../../training.service.js';
import { getApiErrorMessage } from '../../../../services/apiHelpers.js';
import { ReportExportActions } from './ReportExportActions.jsx';

const AVERAGE_LABELS = {
  trainer_score: 'تقييم المدرب',
  content_score: 'تقييم المحتوى',
  activities_score: 'تقييم الأنشطة',
  venue_score: 'تقييم المكان',
  technical_environment_score: 'البيئة التقنية',
  organization_score: 'التنظيم',
  immediate_impact_score: 'الأثر المباشر',
  overall_reaction_score: 'التقييم العام',
};

/**
 * Program/cohort-level course report: completion & dropout rates, average
 * attendance, evaluation aggregates (per-category averages + NPS), and
 * rules-based recommendations.
 * @param {{ programId: string, cohortId?: string, canGenerate?: boolean }} props
 */
export function CourseReportDashboard({ programId, cohortId, canGenerate = false }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [report, setReport] = useState(null);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    if (!programId) return;
    setLoading(true);
    setError('');
    setNotFound(false);
    try {
      const data = await getCourseReport(programId, { cohortId });
      setReport(data);
    } catch (err) {
      const code = err?.response?.data?.code || err?.code;
      if (code === 'COURSE_REPORT_NOT_FOUND') {
        setNotFound(true);
      } else {
        setError(getApiErrorMessage(err, 'تعذر تحميل تقرير الدورة.'));
      }
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [programId, cohortId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleGenerate() {
    setGenerating(true);
    setError('');
    try {
      const data = await generateCourseReport(programId, { cohortId });
      setReport(data);
      setNotFound(false);
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذر توليد تقرير الدورة.'));
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return <LoadingSpinner label="جاري تحميل تقرير الدورة" />;
  }

  if (notFound) {
    return (
      <EmptyState
        title="لا يوجد تقرير للدورة بعد"
        description="يُنشأ تقرير الدورة تلقائيًا عند إنهاء التدريب، أو يمكن توليده يدويًا في أي وقت."
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
  const evalAgg = snap.evaluation || {};
  const averages = evalAgg.averages || {};
  const nps = evalAgg.nps || {};

  return (
    <div className="course-report" dir="rtl">
      <div className="course-report__head">
        <div>
          <h3 className="course-report__title">{snap.programTitle || 'تقرير الدورة'}</h3>
          {report.finalizationMode ? (
            <StatusBadge variant={report.finalizationMode === 'EXCEPTIONAL' ? 'warning' : 'success'}>
              {report.finalizationMode === 'EXCEPTIONAL' ? 'إنهاء استثنائي' : 'إنهاء المستوفين فقط'}
            </StatusBadge>
          ) : null}
        </div>
        <div className="course-report__actions">
          {canGenerate ? (
            <Button type="button" variant="outline" size="sm" loading={generating} onClick={handleGenerate}>
              إعادة توليد
            </Button>
          ) : null}
          <ReportExportActions data={report} filenameBase={`course-report-${programId}`} title="تقرير الدورة" />
        </div>
      </div>

      <div className="eval-metrics-grid">
        <div className="eval-metric-card">
          <div className="eval-metric-card__text">
            <p className="eval-metric-card__label">إجمالي المتدربين</p>
            <p className="eval-metric-card__value">{snap.counts?.total ?? 0}</p>
          </div>
        </div>
        <div className="eval-metric-card">
          <div className="eval-metric-card__text">
            <p className="eval-metric-card__label">نسبة الإكمال</p>
            <p className="eval-metric-card__value">{snap.completionRate != null ? `${snap.completionRate}%` : '—'}</p>
          </div>
        </div>
        <div className="eval-metric-card">
          <div className="eval-metric-card__text">
            <p className="eval-metric-card__label">نسبة الانسحاب</p>
            <p className="eval-metric-card__value">{snap.dropoutRate != null ? `${snap.dropoutRate}%` : '—'}</p>
          </div>
        </div>
        <div className="eval-metric-card">
          <div className="eval-metric-card__text">
            <p className="eval-metric-card__label">متوسط الحضور</p>
            <p className="eval-metric-card__value">
              {snap.averageAttendancePct != null ? `${snap.averageAttendancePct}%` : '—'}
            </p>
          </div>
        </div>
        <div className="eval-metric-card">
          <div className="eval-metric-card__text">
            <p className="eval-metric-card__label">نسبة استجابة التقييم</p>
            <p className="eval-metric-card__value">{evalAgg.responseRate != null ? `${evalAgg.responseRate}%` : '—'}</p>
          </div>
        </div>
        <div className="eval-metric-card">
          <div className="eval-metric-card__text">
            <p className="eval-metric-card__label">مؤشر صافي الترويج (NPS)</p>
            <p className="eval-metric-card__value">{nps.index != null ? nps.index : '—'}</p>
          </div>
        </div>
      </div>

      <h4 className="course-report__section-title">متوسط تقييمات المحاور</h4>
      <div className="eval-metrics-grid">
        {Object.entries(AVERAGE_LABELS).map(([key, label]) => (
          <div key={key} className="eval-metric-card">
            <div className="eval-metric-card__text">
              <p className="eval-metric-card__label">{label}</p>
              <p className="eval-metric-card__value">{averages[key] != null ? averages[key] : '—'}</p>
            </div>
          </div>
        ))}
      </div>

      <h4 className="course-report__section-title">توزيع صافي الترويج</h4>
      <dl className="detail-list">
        <div className="detail-list__row">
          <dt>مروّجون</dt>
          <dd>{nps.promoters ?? 0}</dd>
        </div>
        <div className="detail-list__row">
          <dt>محايدون</dt>
          <dd>{nps.passives ?? 0}</dd>
        </div>
        <div className="detail-list__row">
          <dt>منتقدون</dt>
          <dd>{nps.detractors ?? 0}</dd>
        </div>
      </dl>

      {snap.recommendations?.length ? (
        <>
          <h4 className="course-report__section-title">التوصيات</h4>
          <ul className="course-report__recommendations">
            {snap.recommendations.map((rec, i) => (
              <li key={i}>{rec}</li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

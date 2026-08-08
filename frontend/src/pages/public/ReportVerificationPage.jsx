import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { verifyOfficialReportPublic } from '../../features/training/training.service.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';

/**
 * Public verification page — safe fields only (no trainee performance).
 */
export function ReportVerificationPage() {
  const { verificationCode } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const result = await verifyOfficialReportPublic(verificationCode);
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(getApiErrorMessage(err, 'رمز التحقق غير صالح.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [verificationCode]);

  return (
    <div className="report-verify-page" dir="rtl">
      <div className="report-verify-card">
        <h1>التحقق من تقرير تدريبي</h1>
        {loading ? <LoadingSpinner label="جاري التحقق..." /> : null}
        {error ? (
          <p className="form-field__error" role="alert">
            {error}
          </p>
        ) : null}
        {data ? (
          <dl className="training-report-table">
            <div>
              <dt>نوع التقرير</dt>
              <dd>{data.reportTitle}</dd>
            </div>
            <div>
              <dt>الدورة</dt>
              <dd>{data.course || '—'}</dd>
            </div>
            <div>
              <dt>المؤسسة</dt>
              <dd>{data.institution || '—'}</dd>
            </div>
            <div>
              <dt>تاريخ التوليد</dt>
              <dd>{data.generationDate ? new Date(data.generationDate).toLocaleString('ar') : '—'}</dd>
            </div>
            <div>
              <dt>الإصدار</dt>
              <dd>{data.version}</dd>
            </div>
            <div>
              <dt>المرجع</dt>
              <dd>{data.referenceCode}</dd>
            </div>
            <div>
              <dt>الحالة</dt>
              <dd>{data.status}{data.isLatest ? ' (الأحدث)' : ''}</dd>
            </div>
          </dl>
        ) : null}
      </div>
    </div>
  );
}

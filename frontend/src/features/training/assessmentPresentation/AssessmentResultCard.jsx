import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import { StudentProgressBar } from '../../../components/student/StudentProgressBar.jsx';
import { cn } from '../../../utils/helpers.js';

/**
 * Prominent attempt/result status card for the trainee (own result only).
 */
export function AssessmentResultCard({
  resultMode,
  score,
  passScore,
  passed,
  showResults,
  exhausted,
  className,
}) {
  if (resultMode === 'none') return null;

  if (resultMode === 'pending') {
    return (
      <section
        className={cn('ta-result-card', 'ta-result-card--pending', className)}
        aria-live="polite"
      >
        <h3 className="ta-result-card__title">النتيجة بانتظار مراجعة المدرب</h3>
        <p className="ta-result-card__hint">
          تم تسليم إجاباتك. لن تُعرض نتيجة النجاح أو الرسوب حتى يكتمل التصحيح.
        </p>
        <StatusBadge variant="warning">بانتظار التصحيح</StatusBadge>
      </section>
    );
  }

  const canShowScore = showResults !== false && score != null;
  const isPassed = passed === true;
  const isFailed = passed === false;

  return (
    <section
      className={cn(
        'ta-result-card',
        isPassed && 'ta-result-card--passed',
        isFailed && 'ta-result-card--failed',
        !canShowScore && 'ta-result-card--neutral',
        className
      )}
      aria-live="polite"
    >
      <h3 className="ta-result-card__title">
        {isPassed ? 'تم إكمال الاختبار بنجاح' : 'تم إكمال الاختبار'}
      </h3>

      <div className="ta-result-card__grid">
        <div className="ta-result-card__stat">
          <span className="ta-result-card__stat-label">نتيجتك</span>
          <strong className="ta-result-card__stat-value">
            {canShowScore ? `${score}%` : '—'}
          </strong>
        </div>
        <div className="ta-result-card__stat">
          <span className="ta-result-card__stat-label">درجة النجاح</span>
          <strong className="ta-result-card__stat-value">
            {passScore != null ? `${passScore}%` : '—'}
          </strong>
        </div>
        <div className="ta-result-card__stat">
          <span className="ta-result-card__stat-label">الحالة</span>
          <strong className="ta-result-card__stat-value">
            {!canShowScore ? (
              <StatusBadge variant="info">تم التسليم</StatusBadge>
            ) : isPassed ? (
              <StatusBadge variant="success">ناجح</StatusBadge>
            ) : isFailed ? (
              <StatusBadge variant="danger">لم تحقق درجة النجاح</StatusBadge>
            ) : (
              <StatusBadge variant="muted">مكتمل</StatusBadge>
            )}
          </strong>
        </div>
      </div>

      {canShowScore ? (
        <StudentProgressBar
          className="ta-result-card__bar"
          value={score}
          showLabel
          label="درجتك"
        />
      ) : null}

      {exhausted ? (
        <p className="ta-result-card__exhausted">لقد استخدمت جميع المحاولات المتاحة.</p>
      ) : null}
    </section>
  );
}

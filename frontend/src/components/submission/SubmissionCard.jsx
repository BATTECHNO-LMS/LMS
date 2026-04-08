import { cn } from '../../utils/helpers.js';
import { SubmissionStatusBadge } from '../assessment/SubmissionStatusBadge.jsx';
import { AssessmentTypeBadge } from '../assessment/AssessmentTypeBadge.jsx';
import { useLocale } from '../../features/locale/index.js';
import { translateText } from '../../utils/i18n.js';

export function SubmissionCard({
  title,
  type,
  dueDate,
  submittedAt,
  score,
  state,
  actions,
  className,
}) {
  const { locale } = useLocale();
  return (
    <article className={cn('submission-card', className)}>
      <div className="submission-card__head">
        <h3 className="submission-card__title">{title}</h3>
        {type ? <AssessmentTypeBadge type={type} /> : null}
      </div>
      <dl className="submission-card__meta">
        {dueDate ? (
          <div>
            <dt>{translateText('الاستحقاق', locale)}</dt>
            <dd>{dueDate}</dd>
          </div>
        ) : null}
        {submittedAt ? (
          <div>
            <dt>{translateText('تاريخ التسليم', locale)}</dt>
            <dd>{submittedAt}</dd>
          </div>
        ) : null}
        {score != null && score !== '' ? (
          <div>
            <dt>{translateText('الدرجة', locale)}</dt>
            <dd>{score}</dd>
          </div>
        ) : null}
        <div>
          <dt>{translateText('الحالة', locale)}</dt>
          <dd>
            <SubmissionStatusBadge state={state} />
          </dd>
        </div>
      </dl>
      {actions ? <div className="submission-card__actions">{actions}</div> : null}
    </article>
  );
}

import { cn } from '../../utils/helpers.js';
import { SubmissionStatusBadge } from '../assessment/SubmissionStatusBadge.jsx';
import { AssessmentTypeBadge } from '../assessment/AssessmentTypeBadge.jsx';

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
  return (
    <article className={cn('submission-card', className)}>
      <div className="submission-card__head">
        <h3 className="submission-card__title">{title}</h3>
        {type ? <AssessmentTypeBadge type={type} /> : null}
      </div>
      <dl className="submission-card__meta">
        {dueDate ? (
          <div>
            <dt>الاستحقاق</dt>
            <dd>{dueDate}</dd>
          </div>
        ) : null}
        {submittedAt ? (
          <div>
            <dt>تاريخ التسليم</dt>
            <dd>{submittedAt}</dd>
          </div>
        ) : null}
        {score != null && score !== '' ? (
          <div>
            <dt>الدرجة</dt>
            <dd>{score}</dd>
          </div>
        ) : null}
        <div>
          <dt>الحالة</dt>
          <dd>
            <SubmissionStatusBadge state={state} />
          </dd>
        </div>
      </dl>
      {actions ? <div className="submission-card__actions">{actions}</div> : null}
    </article>
  );
}

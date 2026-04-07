import { cn } from '../../utils/helpers.js';

export function AssessmentActionBar({ title, description, actions, filters, className }) {
  return (
    <div className={cn('assessment-action-bar', className)}>
      <div className="assessment-action-bar__text">
        {title ? <h2 className="assessment-action-bar__title">{title}</h2> : null}
        {description ? <p className="assessment-action-bar__desc">{description}</p> : null}
      </div>
      {filters ? <div className="assessment-action-bar__filters">{filters}</div> : null}
      {actions ? <div className="assessment-action-bar__actions">{actions}</div> : null}
    </div>
  );
}

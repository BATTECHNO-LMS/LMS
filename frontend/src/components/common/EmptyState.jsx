import { cn } from '../../utils/helpers.js';

export function EmptyState({ title, description, action, className }) {
  return (
    <div className={cn('empty-state', className)}>
      <p className="empty-state__title">{title}</p>
      {description ? <p className="empty-state__desc">{description}</p> : null}
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}

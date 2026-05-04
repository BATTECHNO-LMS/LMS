import { cn } from '../../../utils/helpers.js';

/**
 * @param {{ title: string, description?: string, icon?: import('react').ReactNode, className?: string }} props
 */
export function EmptyState({ title, description, icon, className }) {
  return (
    <div className={cn('student-empty-state', className)}>
      {icon ? <div className="student-empty-state__icon">{icon}</div> : null}
      <h3 className="student-empty-state__title">{title}</h3>
      {description ? <p className="student-empty-state__desc">{description}</p> : null}
    </div>
  );
}

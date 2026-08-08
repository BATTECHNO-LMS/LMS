import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import { ClipboardList } from 'lucide-react';

/**
 * Assessment card/page header: title, type badge, status badge, optional description.
 */
export function AssessmentHeader({
  title,
  typeBadgeLabel,
  statusBadge,
  description,
  courseTitle,
  icon: Icon = ClipboardList,
}) {
  return (
    <header className="ta-assessment-header">
      <div className="ta-assessment-header__icon" aria-hidden>
        <Icon size={28} strokeWidth={1.75} />
      </div>
      <div className="ta-assessment-header__body">
        <div className="ta-assessment-header__badges">
          {typeBadgeLabel ? <StatusBadge variant="info">{typeBadgeLabel}</StatusBadge> : null}
          {statusBadge?.label ? (
            <StatusBadge variant={statusBadge.variant || 'default'}>{statusBadge.label}</StatusBadge>
          ) : null}
        </div>
        <h2 className="ta-assessment-header__title">{title}</h2>
        {courseTitle ? <p className="ta-assessment-header__course">{courseTitle}</p> : null}
        {description ? <p className="ta-assessment-header__desc">{description}</p> : null}
      </div>
    </header>
  );
}

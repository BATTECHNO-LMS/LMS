import { SectionCard } from '../admin/SectionCard.jsx';
import { cn } from '../../utils/helpers.js';

/**
 * Student content section — Admin SectionCard with optional leading icon.
 * @param {{ title?: React.ReactNode, icon?: React.ComponentType<{ size?: number }>, actions?: React.ReactNode, children?: React.ReactNode, className?: string }} props
 */
export function StudentSection({ title, icon: Icon, actions, children, className }) {
  const heading =
    title || Icon ? (
      <span className="student-section__title">
        {Icon ? (
          <span className="student-section__icon" aria-hidden>
            <Icon size={18} strokeWidth={2} />
          </span>
        ) : null}
        {title}
      </span>
    ) : null;

  return (
    <SectionCard title={heading} actions={actions} className={cn('student-section', className)}>
      {children}
    </SectionCard>
  );
}

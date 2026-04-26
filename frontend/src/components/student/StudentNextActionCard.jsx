import React from 'react';
import { Calendar, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLocale } from '../../features/locale/index.js';
import { cn } from '../../utils/helpers.js';

/**
 * @param {{
 *   title: string,
 *   description: string,
 *   dueDate?: string | null,
 *   actionLabel: string,
 *   actionTo: string,
 *   type: 'submit' | 'session' | 'alert' | 'cert',
 *   badge?: string | null,
 *   badgeVariant?: 'default' | 'due',
 * }} props
 */
export function StudentNextActionCard({
  title,
  description,
  dueDate,
  actionLabel,
  actionTo,
  type,
  badge = null,
  badgeVariant = 'default',
}) {
  const { dir } = useLocale();

  return (
    <div className={cn('student-action-card', `student-action-card--${type}`)}>
      <div className="student-action-card__body">
        <h4 className="student-action-card__title">{title}</h4>
        <p className="student-action-card__desc">{description}</p>
        {badge ? (
          <span
            className={cn(
              'student-action-card__badge',
              badgeVariant === 'due' && 'student-action-card__badge--due'
            )}
          >
            {badge}
          </span>
        ) : null}
        {dueDate ? (
          <div className="student-action-card__meta">
            <Calendar size={14} aria-hidden />
            <span>{dueDate}</span>
          </div>
        ) : null}
      </div>
      <div className="student-action-card__footer">
        <Link to={actionTo} className="student-action-card__btn">
          {actionLabel}
          <ArrowRight size={16} className={dir === 'rtl' ? 'rotate-180' : ''} aria-hidden />
        </Link>
      </div>
    </div>
  );
}

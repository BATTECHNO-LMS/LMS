import { cn } from '../../utils/helpers.js';

export function AnalyticsSectionCard({ title, description, children, className, id }) {
  return (
    <section className={cn('analytics-section-card', className)} id={id}>
      <header className="analytics-section-card__header">
        <h2 className="analytics-section-card__title">{title}</h2>
        {description ? <p className="analytics-section-card__desc">{description}</p> : null}
      </header>
      <div className="analytics-section-card__body">{children}</div>
    </section>
  );
}

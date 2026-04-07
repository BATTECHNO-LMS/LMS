import { cn } from '../../utils/helpers.js';

export function SectionCard({ title, actions, children, className }) {
  return (
    <section className={cn('section-card', className)}>
      {(title || actions) && (
        <div className="section-card__head">
          {title ? <h2 className="section-card__title">{title}</h2> : <span />}
          {actions ? <div className="section-card__actions">{actions}</div> : null}
        </div>
      )}
      <div className="section-card__body">{children}</div>
    </section>
  );
}

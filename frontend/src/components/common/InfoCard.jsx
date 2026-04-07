import { cn } from '../../utils/helpers.js';

export function InfoCard({ title, children, footer, className }) {
  return (
    <article className={cn('info-card', className)}>
      {title ? <h3 className="info-card__title">{title}</h3> : null}
      <div className="info-card__body">{children}</div>
      {footer ? <div className="info-card__footer">{footer}</div> : null}
    </article>
  );
}

import { cn } from '../../utils/helpers.js';
import { useLocale } from '../../features/locale/index.js';
import { translateText } from '../../utils/i18n.js';

export function InfoCard({ title, children, footer, className }) {
  const { locale } = useLocale();
  return (
    <article className={cn('info-card', className)}>
      {title ? <h3 className="info-card__title">{typeof title === 'string' ? translateText(title, locale) : title}</h3> : null}
      <div className="info-card__body">{children}</div>
      {footer ? <div className="info-card__footer">{footer}</div> : null}
    </article>
  );
}

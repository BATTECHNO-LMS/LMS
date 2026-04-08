import { cn } from '../../utils/helpers.js';
import { useLocale } from '../../features/locale/index.js';
import { translateText } from '../../utils/i18n.js';

export function SectionCard({ title, actions, children, className }) {
  const { locale } = useLocale();
  return (
    <section className={cn('section-card', className)}>
      {(title || actions) && (
        <div className="section-card__head">
          {title ? (
            <h2 className="section-card__title">{typeof title === 'string' ? translateText(title, locale) : title}</h2>
          ) : (
            <span />
          )}
          {actions ? <div className="section-card__actions">{actions}</div> : null}
        </div>
      )}
      <div className="section-card__body">{children}</div>
    </section>
  );
}

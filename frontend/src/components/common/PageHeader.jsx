import { cn } from '../../utils/helpers.js';
import { useLocale } from '../../features/locale/index.js';
import { translateText } from '../../utils/i18n.js';

export function PageHeader({ title, subtitle, actions, className }) {
  const { locale } = useLocale();
  return (
    <header className={cn('page-header', className)}>
      <div className="page-header__text">
        <h1 className="page-header__title">{typeof title === 'string' ? translateText(title, locale) : title}</h1>
        {subtitle ? (
          <p className="page-header__subtitle">
            {typeof subtitle === 'string' ? translateText(subtitle, locale) : subtitle}
          </p>
        ) : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  );
}

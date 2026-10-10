import { cn } from '../../utils/helpers.js';
import { useLocale } from '../../features/locale/index.js';
import { translateText } from '../../utils/i18n.js';

export function AdminPageHeader({ title, description, breadcrumb, actions, icon: Icon, className }) {
  const { locale } = useLocale();
  return (
    <header className={cn('admin-page-header', className)}>
      {breadcrumb ? <div className="admin-page-header__breadcrumb">{breadcrumb}</div> : null}
      <div className="admin-page-header__brand">
        {Icon ? (
          <span className="admin-page-header__icon" aria-hidden>
            <Icon size={20} strokeWidth={1.75} />
          </span>
        ) : null}
        <div>
          <h1 className="admin-page-header__title">{typeof title === 'string' ? translateText(title, locale) : title}</h1>
          {description ? (
            <p className="admin-page-header__desc">
              {typeof description === 'string' ? translateText(description, locale) : description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="admin-page-header__actions">{actions}</div> : null}
    </header>
  );
}

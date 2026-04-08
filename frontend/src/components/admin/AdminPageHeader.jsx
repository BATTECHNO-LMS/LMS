import { cn } from '../../utils/helpers.js';
import { useLocale } from '../../features/locale/index.js';
import { translateText } from '../../utils/i18n.js';

export function AdminPageHeader({ title, description, breadcrumb, className }) {
  const { locale } = useLocale();
  return (
    <header className={cn('admin-page-header', className)}>
      {breadcrumb ? <div className="admin-page-header__breadcrumb">{breadcrumb}</div> : null}
      <h1 className="admin-page-header__title">{typeof title === 'string' ? translateText(title, locale) : title}</h1>
      {description ? (
        <p className="admin-page-header__desc">
          {typeof description === 'string' ? translateText(description, locale) : description}
        </p>
      ) : null}
    </header>
  );
}

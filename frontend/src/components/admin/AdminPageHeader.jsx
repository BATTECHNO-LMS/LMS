import { cn } from '../../utils/helpers.js';

export function AdminPageHeader({ title, description, breadcrumb, className }) {
  return (
    <header className={cn('admin-page-header', className)}>
      {breadcrumb ? <div className="admin-page-header__breadcrumb">{breadcrumb}</div> : null}
      <h1 className="admin-page-header__title">{title}</h1>
      {description ? <p className="admin-page-header__desc">{description}</p> : null}
    </header>
  );
}

import { cn } from '../../utils/helpers.js';

export function PageHeader({ title, subtitle, actions, className }) {
  return (
    <header className={cn('page-header', className)}>
      <div className="page-header__text">
        <h1 className="page-header__title">{title}</h1>
        {subtitle ? <p className="page-header__subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  );
}

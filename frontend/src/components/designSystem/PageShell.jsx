import { cn } from '../../utils/helpers.js';

const MAX_WIDTH_CLASS = {
  md: 'page-shell__container--md',
  lg: 'page-shell__container--lg',
  xl: 'page-shell__container--xl',
  full: 'page-shell__container--full',
};

/**
 * @param {{
 *   title?: React.ReactNode,
 *   description?: React.ReactNode,
 *   actions?: React.ReactNode,
 *   breadcrumbs?: React.ReactNode,
 *   children?: React.ReactNode,
 *   className?: string,
 *   maxWidth?: 'md' | 'lg' | 'xl' | 'full',
 * }} props
 */
export function PageShell({
  title,
  description,
  actions,
  breadcrumbs,
  children,
  className,
  maxWidth = 'xl',
}) {
  const showHeader = title || description || actions || breadcrumbs;

  return (
    <div className={cn('page-shell', className)}>
      <div className={cn('page-shell__container', MAX_WIDTH_CLASS[maxWidth] || MAX_WIDTH_CLASS.xl)}>
        {showHeader ? (
          <header className="page-shell__header">
            <div className="page-shell__header-main">
              {breadcrumbs ? <div className="page-shell__breadcrumbs">{breadcrumbs}</div> : null}
              {title ? <h1 className="page-shell__title">{title}</h1> : null}
              {description ? <p className="page-shell__desc">{description}</p> : null}
            </div>
            {actions ? <div className="page-shell__actions">{actions}</div> : null}
          </header>
        ) : null}
        <div className="page-shell__content">{children}</div>
      </div>
    </div>
  );
}

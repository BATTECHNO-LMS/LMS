import { useMemo } from 'react';
import { cn } from '../../utils/helpers.js';
import { EmptyState } from '../common/EmptyState.jsx';
import { useLocale } from '../../features/locale/index.js';
import { translateText } from '../../utils/i18n.js';
import { getCellContent, resolveMobileLayout } from './dataTableMobileLayout.js';

/**
 * @typedef {{
 *   key: string,
 *   label: string | React.ReactNode,
 *   render?: (row: object) => React.ReactNode,
 *   mobileTitle?: boolean,
 *   mobileSubtitle?: boolean,
 *   mobileVisible?: boolean,
 *   hideOnMobile?: boolean,
 *   priority?: number,
 * }} DataTableColumn
 */

/**
 * @param {{
 *   columns?: DataTableColumn[],
 *   rows?: object[],
 *   className?: string,
 *   emptyTitle?: string | React.ReactNode,
 *   emptyDescription?: string | React.ReactNode,
 *   footer?: React.ReactNode,
 * }} props
 */
export function DataTable({
  columns = [],
  rows = [],
  className,
  emptyTitle = 'لا توجد بيانات',
  emptyDescription = 'لم يتم العثور على سجلات مطابقة.',
  footer,
}) {
  const { locale } = useLocale();
  const layout = useMemo(() => resolveMobileLayout(columns), [columns]);

  const labelFor = (col) => (typeof col.label === 'string' ? translateText(col.label, locale) : col.label);

  if (!rows.length) {
    return (
      <div className={cn('data-table-wrap', className)}>
        <div className="data-table__empty-state">
          <EmptyState
            title={typeof emptyTitle === 'string' ? translateText(emptyTitle, locale) : emptyTitle}
            description={
              typeof emptyDescription === 'string' ? translateText(emptyDescription, locale) : emptyDescription
            }
          />
        </div>
        {footer ? <div className="data-table__footer">{footer}</div> : null}
      </div>
    );
  }

  return (
    <div className={cn('data-table-wrap', className)}>
      <div className="data-table__desktop">
        <div className="data-table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((col) => {
                  const isActionsCol = col.key === 'actions';
                  return (
                    <th key={col.key} className={cn(isActionsCol && 'data-table__col--actions')}>
                      {labelFor(col)}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.id ?? i}>
                  {columns.map((col) => {
                    const isActionsCol = col.key === 'actions';
                    return (
                      <td key={col.key} className={cn(isActionsCol && 'data-table__col--actions')}>
                        {getCellContent(col, row)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="data-table__mobile" role="list">
        {rows.map((row, i) => (
          <article key={row.id ?? i} className="data-table-card" role="listitem">
            {(layout.titleCol || layout.subtitleCol) && (
              <header className="data-table-card__header">
                {layout.titleCol ? (
                  <div className="data-table-card__title">{getCellContent(layout.titleCol, row)}</div>
                ) : null}
                {layout.subtitleCol ? (
                  <div className="data-table-card__subtitle">{getCellContent(layout.subtitleCol, row)}</div>
                ) : null}
              </header>
            )}

            {layout.detailCols.length > 0 ? (
              <dl className="data-table-card__body">
                {layout.detailCols.map((col) => (
                  <div key={col.key} className="data-table-card__row">
                    <dt className="data-table-card__label">{labelFor(col)}</dt>
                    <dd className="data-table-card__value">{getCellContent(col, row)}</dd>
                  </div>
                ))}
              </dl>
            ) : null}

            {layout.actionsCol ? (
              <footer className="data-table-card__actions">{getCellContent(layout.actionsCol, row)}</footer>
            ) : null}
          </article>
        ))}
      </div>

      {footer ? <div className="data-table__footer">{footer}</div> : null}
    </div>
  );
}

import { cn } from '../../utils/helpers.js';
import { EmptyState } from '../common/EmptyState.jsx';

/**
 * @typedef {{ key: string, label: string, render?: (row: object) => React.ReactNode }} Column
 */
export function DataTable({
  columns = [],
  rows = [],
  className,
  emptyTitle = 'لا توجد بيانات',
  emptyDescription = 'لم يتم العثور على سجلات مطابقة.',
  footer,
}) {
  const colCount = columns.length;

  return (
    <div className={cn('data-table-wrap', className)}>
      <div className="data-table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={colCount || 1} className="data-table__empty-cell">
                  <EmptyState title={emptyTitle} description={emptyDescription} />
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={row.id ?? i}>
                  {columns.map((col) => (
                    <td key={col.key}>
                      {typeof col.render === 'function' ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {footer ? <div className="data-table__footer">{footer}</div> : null}
    </div>
  );
}

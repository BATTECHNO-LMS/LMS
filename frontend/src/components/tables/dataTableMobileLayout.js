/**
 * Shared layout rules for DataTable mobile cards (max-width 767px).
 * Desktop is unchanged; columns may set mobileTitle, mobileSubtitle, hideOnMobile, mobileVisible, priority.
 */

export const DATA_TABLE_MOBILE_MAX_PX = 767;

export function isActionsColumn(col) {
  return col?.key === 'actions';
}

export function getCellContent(col, row) {
  if (typeof col?.render === 'function') return col.render(row);
  const v = row?.[col.key];
  return v == null ? '' : v;
}

/** @param {Array<Record<string, unknown>>} columns */
export function resolveMobileLayout(columns) {
  const safe = Array.isArray(columns) ? columns : [];
  const actionsCol = safe.find(isActionsColumn) ?? null;
  const dataCols = safe.filter((c) => !isActionsColumn(c));

  const titleCol = dataCols.find((c) => c.mobileTitle) ?? dataCols[0] ?? null;

  let subtitleCol = dataCols.find((c) => c.mobileSubtitle && c.key !== titleCol?.key) ?? null;
  if (!subtitleCol && titleCol && dataCols.length >= 2) {
    const idx = dataCols.indexOf(titleCol);
    subtitleCol = idx === 0 ? dataCols[1] : dataCols[0];
    if (subtitleCol === titleCol) subtitleCol = null;
  }

  const detailCols = dataCols
    .map((c, originalIndex) => ({ c, originalIndex }))
    .filter(
      ({ c }) =>
        c !== titleCol &&
        c !== subtitleCol &&
        c.hideOnMobile !== true &&
        c.mobileVisible !== false
    )
    .sort((a, b) => {
      const pa = a.c.priority ?? 1000;
      const pb = b.c.priority ?? 1000;
      if (pa !== pb) return pa - pb;
      return a.originalIndex - b.originalIndex;
    })
    .map(({ c }) => c);

  return { actionsCol, titleCol, subtitleCol, detailCols };
}

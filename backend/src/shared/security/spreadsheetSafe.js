'use strict';

/**
 * Neutralize spreadsheet formula injection for user-controlled plain-text cells.
 * Leading = + - @ (and tab/CR) can be interpreted as formulas when opened in Excel/Sheets.
 * Intentional ExcelJS `{ formula: '...' }` cells must NOT pass through this helper.
 *
 * @param {unknown} value
 * @returns {unknown}
 */
function sanitizeSpreadsheetCell(value) {
  if (value == null) return value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value;
  const s = String(value);
  if (!s) return s;
  // Unicode-aware: also strip BOM / zero-width that can hide a leading formula char.
  const trimmed = s.replace(/^\uFEFF/, '');
  if (/^[=+\-@\t\r]/.test(trimmed)) return `'${s}`;
  return s;
}

/**
 * CSV cell escape with formula neutralization.
 * @param {unknown} value
 * @returns {string}
 */
function escapeCsvCell(value) {
  if (value == null) return '';
  const s = String(sanitizeSpreadsheetCell(value));
  return /[,"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

module.exports = {
  sanitizeSpreadsheetCell,
  escapeCsvCell,
};

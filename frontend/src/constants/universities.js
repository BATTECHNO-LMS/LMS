/**
 * Registration / catalog helpers — real university rows must come from the API.
 * @param {Array<{ id: string, name?: string, name_en?: string | null, short_name?: string | null }>} rows
 * @param {{ locale?: string }} [options]
 * @returns {Array<{ id: string, name: string }>}
 */
export function mapUniversitiesForSelect(rows, options = {}) {
  if (!Array.isArray(rows)) return [];
  const useEn = String(options.locale || '').toLowerCase().startsWith('en');
  return rows.map((u) => {
    const ar = u.name != null ? String(u.name) : '';
    const en = u.name_en != null ? String(u.name_en) : '';
    const label = useEn ? en || ar : ar || en;
    return {
      id: String(u.id),
      name: label || String(u.short_name || u.code || u.id),
    };
  });
}

/**
 * Registration / catalog helpers — real university rows must come from the API.
 * @param {Array<{ id: string, name?: string }>} rows
 * @returns {Array<{ id: string, name: string }>}
 */
export function mapUniversitiesForSelect(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((u) => ({
    id: String(u.id),
    name: String(u.name ?? u.id),
  }));
}

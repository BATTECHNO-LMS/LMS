import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { unwrapApiData } from '../../services/apiHelpers.js';

/** Public catalog of active global specialties (registration + admin forms). */
export async function fetchActiveSpecialties() {
  const res = await apiClient.get(endpoints.specialties);
  const payload = unwrapApiData(res);
  const list = payload?.specialties;
  if (!Array.isArray(list)) {
    throw new Error('Invalid specialties catalog response');
  }
  return list;
}

/**
 * @param {{ id: string, name_ar: string, name_en?: string | null }} specialty
 * @param {string} [lang]
 * @param {string} [fallback]
 */
export function getSpecialtyLabel(specialty, lang = 'ar', fallback = '—') {
  if (!specialty) return fallback;
  const useAr = lang === 'ar' || lang.startsWith('ar');
  if (useAr) return specialty.name_ar || specialty.name_en || fallback;
  return specialty.name_en || specialty.name_ar || fallback;
}

/**
 * @param {{ id: string, nameAr: string, nameEn?: string | null }} specialty
 * @param {string} [lang]
 * @param {string} [fallback]
 */
export function getUniversitySpecialtyLabel(specialty, lang = 'ar', fallback = '—') {
  if (!specialty) return fallback;
  const useAr = lang === 'ar' || lang.startsWith('ar');
  if (useAr) return specialty.nameAr || specialty.nameEn || fallback;
  return specialty.nameEn || specialty.nameAr || fallback;
}

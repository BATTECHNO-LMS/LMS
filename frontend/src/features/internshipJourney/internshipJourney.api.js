import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { FALLBACK_UNIVERSITIES } from './internshipJourney.data.js';

function unwrap(res) {
  return res?.data?.data ?? res?.data;
}

/**
 * Load public university directory. Falls back to static names if the API is unreachable.
 * Does not invent faculty↔university relationships.
 */
export async function fetchInternshipJourneyUniversities() {
  try {
    const res = await apiClient.get(endpoints.public.internshipJourneyUniversities);
    const payload = unwrap(res);
    const list = Array.isArray(payload?.universities) ? payload.universities : [];
    if (!list.length) {
      return {
        source: 'fallback',
        universities: FALLBACK_UNIVERSITIES.map((name) => ({
          id: null,
          name,
          name_en: null,
          short_name: null,
          code: null,
        })),
      };
    }
    return { source: 'api', universities: list };
  } catch {
    return {
      source: 'fallback',
      universities: FALLBACK_UNIVERSITIES.map((name) => ({
        id: null,
        name,
        name_en: null,
        short_name: null,
        code: null,
      })),
    };
  }
}

/**
 * Server-side validation of the academic profile. Query params are never treated as authoritative.
 */
export async function validateInternshipAcademicProfile(profile) {
  const res = await apiClient.post(endpoints.public.internshipJourneyValidate, {
    universityId: profile.universityId || undefined,
    universityName: profile.universityName,
    isOtherUniversity: Boolean(profile.isOtherUniversity),
    facultyCode: profile.facultyCode,
    facultyName: profile.facultyName,
    isOtherFaculty: Boolean(profile.isOtherFaculty),
    majorCode: profile.majorCode,
    trainingHours: profile.trainingHours,
    trackCode: profile.trackCode,
  });
  return unwrap(res);
}

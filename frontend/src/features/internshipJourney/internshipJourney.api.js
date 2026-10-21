import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import {
  getActiveJordanUniversities,
  universitySearchKeywords,
} from './internshipJourney.universities.js';

function unwrap(res) {
  return res?.data?.data ?? res?.data;
}

function localDirectory() {
  return {
    source: 'directory',
    universities: getActiveJordanUniversities().map((u) => ({
      code: u.code,
      name: u.nameAr,
      name_ar: u.nameAr,
      name_en: u.nameEn || null,
      category: u.category,
      aliases: u.aliases || [],
      keywords: universitySearchKeywords(u),
      eprojectoUniversityId: null,
      id: null,
    })),
  };
}

/**
 * Public Jordan university directory for intake.
 * Prefer local canonical directory; optionally hydrate from API if it returns the same shape.
 * Never limited to eprojecto tenant universities.
 */
export async function fetchInternshipJourneyUniversities() {
  try {
    const res = await apiClient.get(endpoints.public.internshipJourneyUniversities);
    const payload = unwrap(res);
    const list = Array.isArray(payload?.universities) ? payload.universities : [];
    if (list.length && list.some((u) => u.code && u.category)) {
      return {
        source: payload?.source || 'api',
        universities: list.map((u) => ({
          code: u.code,
          name: u.nameAr || u.name,
          name_ar: u.nameAr || u.name,
          name_en: u.nameEn || u.name_en || null,
          category: u.category,
          aliases: u.aliases || [],
          keywords: [u.nameAr || u.name, u.nameEn, u.code, ...(u.aliases || [])].filter(Boolean).join(' '),
          eprojectoUniversityId: u.eprojectoUniversityId || null,
          id: u.eprojectoUniversityId || null,
        })),
      };
    }
  } catch {
    /* fall through to local directory */
  }
  return localDirectory();
}

export async function validateInternshipAcademicProfile(profile) {
  const res = await apiClient.post(endpoints.public.internshipJourneyValidate, {
    universityCode: profile.universityCode,
    universityName: profile.universityName,
    isOtherUniversity: Boolean(profile.isOtherUniversity),
    eprojectoUniversityId: profile.eprojectoUniversityId || undefined,
    facultyCode: profile.facultyCode,
    facultyName: profile.facultyName,
    facultyCustomName: profile.facultyCustomName || undefined,
    isOtherFaculty: Boolean(profile.isOtherFaculty),
    majorCode: profile.majorCode,
    majorCustomName: profile.majorCustomName || undefined,
    trainingHours: profile.trainingHours,
    trackCode: profile.trackCode,
  });
  return unwrap(res);
}

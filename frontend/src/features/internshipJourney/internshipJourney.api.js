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

function toAcademicPayload(profile) {
  return {
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
  };
}

export async function validateInternshipAcademicProfile(profile) {
  const res = await apiClient.post(endpoints.public.internshipJourneyValidate, toAcademicPayload(profile));
  return unwrap(res);
}

function parseFilename(contentDisposition, fallback) {
  const utf = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition || '');
  if (utf?.[1]) {
    try {
      return decodeURIComponent(utf[1]);
    } catch {
      /* fall through */
    }
  }
  const match = /filename="([^"]+)"/i.exec(contentDisposition || '');
  return match?.[1] ?? fallback;
}

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Download branded Field Training plan PDF from the public API (Chromium RTL render).
 */
export async function downloadInternshipPlanPdf(profile) {
  const res = await apiClient.post(endpoints.public.internshipJourneyPlanPdf, toAcademicPayload(profile), {
    responseType: 'blob',
    timeout: 90_000,
  });
  const blob = res.data;
  if (!(blob instanceof Blob) || blob.type?.includes('json')) {
    let message = 'تعذر تحميل ملف PDF.';
    try {
      const text = await blob.text();
      const parsed = JSON.parse(text);
      message = parsed?.message || message;
    } catch {
      /* keep default */
    }
    throw new Error(message);
  }
  const stamp = new Date().toISOString().slice(0, 10);
  const fallback = `eprojecto-field-training-plan-${profile.trainingHours || 'plan'}h-${stamp}.pdf`;
  const filename = parseFilename(res.headers?.['content-disposition'], fallback);
  triggerBlobDownload(blob, filename);
  return { filename };
}

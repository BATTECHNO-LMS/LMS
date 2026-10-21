import { ACADEMIC_PROFILE_STORAGE_KEY } from './internshipJourney.data.js';

export function saveAcademicProfile(profile) {
  if (typeof sessionStorage === 'undefined' || !profile) return;
  try {
    sessionStorage.setItem(ACADEMIC_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    /* quota / private mode */
  }
}

export function loadAcademicProfile() {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(ACADEMIC_PROFILE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearAcademicProfile() {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(ACADEMIC_PROFILE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

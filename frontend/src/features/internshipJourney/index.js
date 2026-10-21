export * from './internshipJourney.data.js';
export * from './internshipJourney.universities.js';
export {
  OTHER_FACULTY,
  OTHER_MAJOR,
  TRACK_NOT_CONFIGURED,
  REQUIRES_REVIEW,
  FACULTIES,
  MAJORS,
  MAJOR_TO_TRACK,
  ACADEMIC_MAJORS,
  getActiveFaculties,
  getFaculty,
  getMajorsForFaculty,
  getMajor,
  isMajorAllowedForFaculty,
  resolveTrackCodeForMajor,
  getActiveMajors,
} from './internshipJourney.taxonomy.js';
export { TRACK_CATALOG, getActiveTracks } from './internshipJourney.tracks.js';
export * from './buildJourney.js';
export * from './internshipJourney.analytics.js';
export * from './internshipJourney.storage.js';

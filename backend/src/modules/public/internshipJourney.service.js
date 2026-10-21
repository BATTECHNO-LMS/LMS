const { prisma } = require('../../config/db');
const {
  MAJOR_TO_TRACK,
  TRACK_SUMMARIES,
  isSupportedHours,
  allocateHours,
  getIntensityBand,
} = require('./internshipJourney.constants');

/** Public directory fields only — no admin metadata, contacts, or secrets. */
async function listPublicUniversities() {
  const universities = await prisma.universities.findMany({
    where: { status: 'active' },
    select: {
      id: true,
      name: true,
      name_en: true,
      short_name: true,
      code: true,
    },
    orderBy: { name: 'asc' },
  });
  return { universities };
}

function listPublicTracks() {
  return {
    majors: Object.keys(MAJOR_TO_TRACK).map((code) => ({
      code,
      trackCode: MAJOR_TO_TRACK[code],
      ...TRACK_SUMMARIES[MAJOR_TO_TRACK[code]],
    })),
    tracks: Object.values(TRACK_SUMMARIES),
  };
}

/**
 * Validate academic intake payload. Does not create University / Faculty / application records.
 * Query-string values must never be trusted as authoritative — callers POST a body.
 */
async function validateAcademicProfile(body) {
  const errors = {};

  const universityName = String(body.universityName || '').trim();
  const isOtherUniversity = Boolean(body.isOtherUniversity);
  let universityId = body.universityId || null;

  if (!universityName) {
    errors.university = 'يرجى اختيار الجامعة.';
  }

  if (universityId) {
    const uni = await prisma.universities.findFirst({
      where: { id: universityId, status: 'active' },
      select: { id: true, name: true },
    });
    if (!uni) {
      errors.university = 'الجامعة المحددة غير متاحة.';
      universityId = null;
    } else if (!isOtherUniversity && uni.name !== universityName) {
      // Prefer canonical name from DB when id is provided.
      body = { ...body, universityName: uni.name };
    }
  }

  if (isOtherUniversity) {
    universityId = null;
  }

  const facultyCode = String(body.facultyCode || '').trim();
  const facultyName = String(body.facultyName || '').trim();
  const isOtherFaculty = Boolean(body.isOtherFaculty) || facultyCode === 'other';
  if (!facultyCode || !facultyName) {
    errors.faculty = 'يرجى اختيار الكلية.';
  }

  const majorCode = String(body.majorCode || '').trim();
  if (!MAJOR_TO_TRACK[majorCode]) {
    errors.major = 'يرجى اختيار التخصص.';
  }

  const trainingHours = Number(body.trainingHours);
  if (!isSupportedHours(trainingHours)) {
    errors.hours = 'يرجى تحديد عدد ساعات التدريب بين 80 و300 بزيادة 10 ساعات.';
  }

  const expectedTrack = MAJOR_TO_TRACK[majorCode];
  const trackCode = String(body.trackCode || expectedTrack || '').trim();
  if (expectedTrack && trackCode && trackCode !== expectedTrack) {
    errors.track = 'رمز المسار لا يطابق التخصص المحدد.';
  }

  if (Object.keys(errors).length) {
    return { valid: false, errors };
  }

  const track = TRACK_SUMMARIES[expectedTrack];
  const allocation = allocateHours(trainingHours);
  const intensity = getIntensityBand(trainingHours);

  return {
    valid: true,
    profile: {
      universityId,
      universityName: isOtherUniversity ? universityName : universityName,
      isOtherUniversity,
      facultyCode,
      facultyName,
      isOtherFaculty,
      majorCode,
      trainingHours,
      trackCode: expectedTrack,
      trackNameAr: track.nameAr,
      trackNameEn: track.nameEn,
      finalProject: track.finalProject,
    },
    allocation,
    intensity,
    // Explicit: this endpoint never persists intake rows.
    persisted: false,
  };
}

module.exports = {
  listPublicUniversities,
  listPublicTracks,
  validateAcademicProfile,
};

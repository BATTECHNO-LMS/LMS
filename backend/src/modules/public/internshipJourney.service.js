const fs = require('fs');
const path = require('path');
const {
  TRACK_SUMMARIES,
  isSupportedHours,
  allocateHours,
  getIntensityBand,
} = require('./internshipJourney.constants');
const {
  OTHER_FACULTY,
  OTHER_MAJOR,
  TRACK_NOT_CONFIGURED,
  REQUIRES_REVIEW,
  FACULTIES,
  getMajor,
  getMajorsForFaculty,
  isMajorAllowedForFaculty,
  resolveTrackCodeForMajor,
} = require('./internshipJourney.taxonomy');
const {
  OTHER_UNIVERSITY,
  EPROJECTO_UNIVERSITY_ID_BY_CODE,
  getActiveJordanUniversities,
  findJordanUniversity,
  countByCategory,
} = require('./internshipJourney.universities');
const { buildInternshipPlanPdfHtml } = require('./internshipJourney.pdfTemplate');
const { renderHtmlToPdf } = require('../analytics/pdfRenderer');

function loadBrandLogoDataUri() {
  const candidates = [
    path.join(__dirname, '../../../../frontend/src/assets/images/eprojecto-logo.png'),
    path.join(__dirname, '../../../assets/eprojecto-logo.png'),
    path.join(__dirname, '../../../../frontend/src/assets/images/batman-logo.png'),
  ];
  for (const filePath of candidates) {
    try {
      if (fs.existsSync(filePath)) {
        const buf = fs.readFileSync(filePath);
        const ext = path.extname(filePath).toLowerCase() === '.png' ? 'png' : 'png';
        return `data:image/${ext};base64,${buf.toString('base64')}`;
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

function buildPlanPdfFilename(profile) {
  const stamp = new Date().toISOString().slice(0, 10);
  const hours = profile?.trainingHours || 'plan';
  return `eprojecto-field-training-plan-${hours}h-${stamp}.pdf`;
}

/** Public Jordan directory — not limited to eprojecto tenants. */
function listPublicUniversities() {
  const universities = getActiveJordanUniversities().map((u) => ({
    code: u.code,
    nameAr: u.nameAr,
    name: u.nameAr,
    nameEn: u.nameEn || null,
    category: u.category,
    aliases: u.aliases || [],
    eprojectoUniversityId: EPROJECTO_UNIVERSITY_ID_BY_CODE[u.code] || null,
  }));
  return {
    source: 'jordan_directory',
    universities,
    counts: countByCategory(),
  };
}

function listPublicTracks() {
  return {
    faculties: Object.values(FACULTIES),
    majorsByFaculty: {
      BUSINESS: getMajorsForFaculty('BUSINESS'),
      INFORMATION_TECHNOLOGY: getMajorsForFaculty('INFORMATION_TECHNOLOGY'),
    },
    tracks: Object.values(TRACK_SUMMARIES).filter((t) => t.configured !== false),
  };
}

/**
 * Validate academic intake. Enforces Faculty→Major and Major→Track server-side.
 * Never creates University/Faculty DB rows.
 */
async function validateAcademicProfile(body) {
  const errors = {};

  const universityCode = String(body.universityCode || '').trim();
  const isOtherUniversity = Boolean(body.isOtherUniversity) || universityCode === OTHER_UNIVERSITY;
  let universityName = String(body.universityName || '').trim();
  let eprojectoUniversityId = body.eprojectoUniversityId || null;

  if (!universityCode) {
    errors.university = 'يرجى اختيار الجامعة.';
  } else if (isOtherUniversity) {
    eprojectoUniversityId = null;
    if (!universityName) errors.university = 'يرجى اختيار الجامعة.';
  } else {
    const uni = findJordanUniversity(universityCode);
    if (!uni) {
      errors.university = 'يرجى اختيار الجامعة.';
    } else {
      universityName = uni.nameAr;
      eprojectoUniversityId = EPROJECTO_UNIVERSITY_ID_BY_CODE[uni.code] || null;
    }
  }

  const facultyCode = String(body.facultyCode || '').trim();
  const isOtherFaculty = Boolean(body.isOtherFaculty) || facultyCode === OTHER_FACULTY;
  const facultyMeta = FACULTIES[facultyCode];
  let facultyName = String(body.facultyName || '').trim();
  const facultyCustomName = String(body.facultyCustomName || '').trim() || null;

  if (!facultyMeta) {
    errors.faculty = 'يرجى اختيار الكلية.';
  } else if (isOtherFaculty) {
    facultyName = facultyCustomName || facultyName;
    if (!facultyName) errors.faculty = 'يرجى إدخال اسم الكلية.';
  } else {
    facultyName = facultyMeta.labelAr;
  }

  let majorCode = String(body.majorCode || '').trim();
  const majorCustomName = String(body.majorCustomName || '').trim() || null;
  const majorMeta = getMajor(majorCode);
  const isOtherMajor = Boolean(majorMeta?.isOther) || majorCode === OTHER_MAJOR;

  if (isOtherFaculty) {
    majorCode = OTHER_MAJOR;
    if (!majorCustomName) errors.major = 'يرجى إدخال اسم التخصص.';
  } else if (!majorCode) {
    errors.major = 'يرجى اختيار التخصص.';
  } else if (!isMajorAllowedForFaculty(facultyCode, majorCode)) {
    errors.major = 'التخصص لا ينتمي إلى الكلية المحددة.';
  } else if (isOtherMajor && !majorCustomName) {
    errors.major = 'يرجى إدخال اسم التخصص.';
  }

  const trainingHours = Number(body.trainingHours);
  if (!isSupportedHours(trainingHours)) {
    errors.hours = 'يرجى تحديد عدد ساعات التدريب بين 80 و300 بزيادة 10 ساعات.';
  }

  const derivedTrack = resolveTrackCodeForMajor(majorCode, facultyCode);
  const clientTrack = String(body.trackCode || '').trim();
  if (derivedTrack && clientTrack && clientTrack !== derivedTrack) {
    errors.track = 'رمز المسار لا يطابق التخصص المحدد.';
  }

  if (Object.keys(errors).length) {
    return { valid: false, errors };
  }

  const trackCode = derivedTrack || TRACK_NOT_CONFIGURED;
  const track = TRACK_SUMMARIES[trackCode] || TRACK_SUMMARIES[TRACK_NOT_CONFIGURED];
  const allocation = allocateHours(trainingHours);
  const intensity = getIntensityBand(trainingHours);

  return {
    valid: true,
    profile: {
      universityCode: isOtherUniversity ? OTHER_UNIVERSITY : universityCode,
      eprojectoUniversityId,
      universityName,
      isOtherUniversity,
      facultyCode,
      facultyName,
      facultyCustomName: isOtherFaculty ? facultyName : null,
      isOtherFaculty,
      majorCode,
      majorCustomName: isOtherMajor || isOtherFaculty ? majorCustomName : null,
      majorLabelAr: isOtherMajor || isOtherFaculty ? majorCustomName : majorMeta.labelAr,
      trainingHours,
      trackCode,
      trackNameAr: track.nameAr,
      trackNameEn: track.nameEn,
      finalProject: track.finalProject,
      trackConfigured: track.configured !== false && trackCode !== TRACK_NOT_CONFIGURED && trackCode !== REQUIRES_REVIEW,
    },
    allocation,
    intensity,
    persisted: false,
  };
}

/**
 * Validate intake body and render a branded Arabic RTL PDF of the training plan.
 * @returns {Promise<{ buffer: Buffer, filename: string, profile: object }>}
 */
async function generatePlanPdf(body) {
  const result = await validateAcademicProfile(body);
  if (!result.valid) {
    const err = new Error(Object.values(result.errors)[0] || 'بيانات غير مكتملة');
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    err.details = { fields: result.errors };
    throw err;
  }

  const html = buildInternshipPlanPdfHtml({
    profile: result.profile,
    allocation: result.allocation,
    intensity: result.intensity,
    logoDataUri: loadBrandLogoDataUri(),
    generatedAt: new Date(),
  });

  const buffer = await renderHtmlToPdf(html, {
    lang: 'ar',
    footerNote: 'خطة تدريب ميداني استرشادية · eprojecto',
    footerLeft: 'BATMAN TECHNOLOGY · Field Training',
    margin: { top: '10mm', right: '10mm', bottom: '16mm', left: '10mm' },
  });

  return {
    buffer,
    filename: buildPlanPdfFilename(result.profile),
    profile: result.profile,
  };
}

module.exports = {
  listPublicUniversities,
  listPublicTracks,
  validateAcademicProfile,
  generatePlanPdf,
  buildPlanPdfFilename,
  loadBrandLogoDataUri,
};

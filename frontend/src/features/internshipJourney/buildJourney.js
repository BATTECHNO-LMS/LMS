import {
  ALLOCATION_PERCENT,
  FINAL_STAGE_STYLE,
  HOURS_OPTIONS,
  INTENSITY_BANDS,
  OTHER_FACULTY,
  OTHER_MAJOR,
  OTHER_UNIVERSITY,
  PRACTICAL_TASKS_PREVIEW_COUNT,
  PROFESSIONAL_FOUNDATION,
  SPECIALIZATION_STAGE_STYLE,
  TASKS_STAGE_STYLE,
  WEEKLY_HOURS_MODEL,
} from './internshipJourney.data.js';
import { findJordanUniversity } from './internshipJourney.universities.js';
import {
  getFaculty,
  getMajor,
  isMajorAllowedForFaculty,
  resolveTrackCodeForMajor,
} from './internshipJourney.taxonomy.js';
import { TRACK_CATALOG, TRACK_NOT_CONFIGURED, REQUIRES_REVIEW } from './internshipJourney.tracks.js';

export function isSupportedHours(hours) {
  return Number.isInteger(hours) && HOURS_OPTIONS.includes(hours);
}

export function getIntensityBand(hours) {
  return INTENSITY_BANDS.find((band) => hours >= band.min && hours <= band.max) ?? null;
}

export function allocateHours(totalHours) {
  const foundation = Math.round((totalHours * ALLOCATION_PERCENT.foundation) / 100);
  const specialization = Math.round((totalHours * ALLOCATION_PERCENT.specialization) / 100);
  const tasks = Math.round((totalHours * ALLOCATION_PERCENT.tasks) / 100);
  const finalProject = totalHours - foundation - specialization - tasks;
  return {
    total: totalHours,
    foundation,
    specialization,
    tasks,
    finalProject,
    softSkills: foundation,
    commonIt: 0,
    specialized: specialization,
    modules: [specialization],
  };
}

export function getTrackFamilyKey(majorKey, facultyCode) {
  return resolveTrackCodeForMajor(majorKey, facultyCode);
}

export function getTrackForMajor(majorKey, facultyCode) {
  const familyKey = getTrackFamilyKey(majorKey, facultyCode);
  return familyKey ? TRACK_CATALOG[familyKey] ?? TRACK_CATALOG[TRACK_NOT_CONFIGURED] : null;
}

export function getMajorMeta(majorKey) {
  const m = getMajor(majorKey);
  if (!m) return null;
  return { value: m.code, label: m.labelAr, labelEn: m.labelEn, trackCode: m.trackCode, facultyCode: m.facultyCode };
}

export function buildJourneyStages(track, totalHours) {
  const allocation = allocateHours(totalHours);
  return [
    { ...PROFESSIONAL_FOUNDATION, hours: allocation.foundation },
    {
      name: `المحطة ${SPECIALIZATION_STAGE_STYLE.ordinal}: التخصص`,
      title: track.nameEn,
      emoji: SPECIALIZATION_STAGE_STYLE.emoji,
      desc: track.descriptionAr,
      hours: allocation.specialization,
      color: SPECIALIZATION_STAGE_STYLE.color,
      tags: (track.skills || []).slice(0, 6),
      tasks: track.curriculumModules || [],
    },
    {
      name: `المحطة ${TASKS_STAGE_STYLE.ordinal}: المهام العملية`,
      title: 'Practical Tasks',
      emoji: TASKS_STAGE_STYLE.emoji,
      desc: 'مهام عملية قابلة للتسليم مع مراجعة المشرف.',
      hours: allocation.tasks,
      color: TASKS_STAGE_STYLE.color,
      tags: ['Tickets', 'Evidence', 'Mentor Review'],
      tasks: track.practicalTasks || [],
    },
    {
      name: `المحطة ${FINAL_STAGE_STYLE.ordinal}: المشروع والإطلاق`,
      title: 'Final Project & Portfolio',
      emoji: FINAL_STAGE_STYLE.emoji,
      desc: `المشروع النهائي: ${track.finalProject}`,
      hours: allocation.finalProject,
      color: FINAL_STAGE_STYLE.color,
      tags: ['Final Project', 'Portfolio', 'Demo'],
      tasks: [
        `تنفيذ مشروع: ${track.finalProject}`,
        'توثيق الأدلة والمخرجات',
        'إعداد Portfolio مختصر',
        'عرض Demo أمام المشرف',
      ],
    },
  ];
}

/**
 * @returns {{ ok: true, profile: object } | { ok: false, errors: Record<string, string> }}
 */
export function validateAcademicProfile(input) {
  const errors = {};
  const universityCode = input.universityCode || input.universityValue || '';
  const isOtherUniversity = universityCode === OTHER_UNIVERSITY;
  const directoryUni = !isOtherUniversity ? findJordanUniversity(universityCode) : null;
  const universityName = (
    isOtherUniversity ? input.otherUniversityName || input.universityName : directoryUni?.nameAr || input.universityName
  )
    ?.trim?.() || '';

  if (!universityCode) {
    errors.university = 'يرجى اختيار الجامعة.';
  } else if (isOtherUniversity && !universityName) {
    errors.university = 'يرجى اختيار الجامعة.';
  } else if (!isOtherUniversity && !directoryUni) {
    errors.university = 'يرجى اختيار الجامعة.';
  }

  const facultyCode = input.facultyCode ?? '';
  const isOtherFaculty = facultyCode === OTHER_FACULTY;
  const facultyMeta = getFaculty(facultyCode);
  const facultyName = (isOtherFaculty ? input.otherFacultyName || input.facultyName : facultyMeta?.labelAr || input.facultyName)
    ?.trim?.() || '';

  if (!facultyCode || !facultyMeta) {
    errors.faculty = 'يرجى اختيار الكلية.';
  } else if (isOtherFaculty && !facultyName) {
    errors.faculty = 'يرجى إدخال اسم الكلية.';
  }

  let majorCode = input.majorCode ?? '';
  const majorMeta = getMajor(majorCode);
  const isOtherMajor = Boolean(majorMeta?.isOther) || majorCode === OTHER_MAJOR;
  const majorCustomName = (input.otherMajorName || input.majorCustomName || '')?.trim?.() || '';

  if (isOtherFaculty) {
    majorCode = OTHER_MAJOR;
    if (!majorCustomName) {
      errors.major = 'يرجى إدخال اسم التخصص.';
    }
  } else if (!majorCode) {
    errors.major = 'يرجى اختيار التخصص.';
  } else if (!isMajorAllowedForFaculty(facultyCode, majorCode)) {
    errors.major = 'التخصص لا ينتمي إلى الكلية المحددة.';
  } else if (isOtherMajor && !majorCustomName) {
    errors.major = 'يرجى إدخال اسم التخصص.';
  }

  const trainingHours = Number(input.trainingHours);
  if (!isSupportedHours(trainingHours)) {
    errors.hours = 'يرجى تحديد عدد ساعات التدريب.';
  }

  if (Object.keys(errors).length) {
    return { ok: false, errors };
  }

  const trackCode = resolveTrackCodeForMajor(majorCode, facultyCode);
  const track = TRACK_CATALOG[trackCode] || TRACK_CATALOG[TRACK_NOT_CONFIGURED];
  const majorLabelAr = isOtherMajor || isOtherFaculty ? majorCustomName : majorMeta?.labelAr || majorCode;

  return {
    ok: true,
    profile: {
      universityCode: isOtherUniversity ? OTHER_UNIVERSITY : universityCode,
      eprojectoUniversityId: null,
      universityName,
      isOtherUniversity,
      facultyCode,
      facultyName,
      facultyCustomName: isOtherFaculty ? facultyName : null,
      isOtherFaculty,
      majorCode,
      majorCustomName: isOtherMajor || isOtherFaculty ? majorCustomName : null,
      majorLabelAr,
      majorLabelEn: isOtherMajor || isOtherFaculty ? majorCustomName : majorMeta?.labelEn || majorCode,
      trainingHours,
      trackCode,
      trackNameAr: track.nameAr,
      trackNameEn: track.nameEn,
      trackConfigured: track.configured !== false && trackCode !== TRACK_NOT_CONFIGURED && trackCode !== REQUIRES_REVIEW,
    },
  };
}

export function buildJourneyPlan(selection) {
  const validated = validateAcademicProfile(selection);
  if (!validated.ok) {
    throw new Error(Object.values(validated.errors)[0] || 'بيانات غير مكتملة');
  }

  const { profile } = validated;
  const track = getTrackForMajor(profile.majorCode, profile.facultyCode);
  if (!track) throw new Error(`Unknown academic major: ${profile.majorCode}`);
  if (!isSupportedHours(profile.trainingHours)) {
    throw new Error(`Unsupported internship hours: ${profile.trainingHours}`);
  }

  const allocation = allocateHours(profile.trainingHours);
  const intensity = getIntensityBand(profile.trainingHours);
  const pendingNote = !profile.trackConfigured
    ? ' سيتم تجهيز المسار التدريبي المناسب لهذا التخصص.'
    : '';

  return {
    ...profile,
    university: profile.universityName,
    hours: profile.trainingHours,
    majorKey: profile.majorCode,
    track,
    allocation,
    intensity,
    weeks: Math.ceil(profile.trainingHours / WEEKLY_HOURS_MODEL),
    stages: buildJourneyStages(track, profile.trainingHours),
    previewTasks: (track.practicalTasks || []).slice(0, PRACTICAL_TASKS_PREVIEW_COUNT),
    headline: track.nameAr,
    subtitle: `${profile.universityName} • ${profile.facultyName} • ${profile.trainingHours} ساعة • ${track.nameEn}`,
    projectSummary: `${track.finalProject} | مخرجات التسليم: ${track.artifacts}${pendingNote}`,
    structureSummary: [
      { key: 'foundation', label: 'Professional Foundation', hours: allocation.foundation },
      { key: 'specialization', label: 'Specialized Training', hours: allocation.specialization },
      { key: 'tasks', label: 'Practical Tasks', hours: allocation.tasks },
      { key: 'finalProject', label: 'Final Project / Portfolio', hours: allocation.finalProject },
    ],
  };
}

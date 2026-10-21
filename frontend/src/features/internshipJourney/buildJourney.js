import {
  ALLOCATION_PERCENT,
  FINAL_STAGE_STYLE,
  HOURS_OPTIONS,
  INTENSITY_BANDS,
  OTHER_FACULTY,
  OTHER_UNIVERSITY,
  PRACTICAL_TASKS_PREVIEW_COUNT,
  PROFESSIONAL_FOUNDATION,
  SPECIALIZATION_STAGE_STYLE,
  TASKS_STAGE_STYLE,
  WEEKLY_HOURS_MODEL,
} from './internshipJourney.data.js';
import {
  ACADEMIC_MAJORS,
  MAJOR_TO_TRACK,
  TRACK_CATALOG,
} from './internshipJourney.tracks.js';

export function isSupportedHours(hours) {
  return Number.isInteger(hours) && HOURS_OPTIONS.includes(hours);
}

export function getIntensityBand(hours) {
  return INTENSITY_BANDS.find((band) => hours >= band.min && hours <= band.max) ?? null;
}

/**
 * Splits total hours into foundation / specialization / tasks / final project.
 * Rounding is applied to the first three buckets; final project takes the remainder
 * so the four always sum to exactly `totalHours`.
 */
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
    // Back-compat aliases used by older dashboard wording during transition
    softSkills: foundation,
    commonIt: 0,
    specialized: specialization,
    modules: [specialization],
  };
}

export function getTrackFamilyKey(majorKey) {
  return MAJOR_TO_TRACK[majorKey] ?? null;
}

export function getTrackForMajor(majorKey) {
  const familyKey = getTrackFamilyKey(majorKey);
  return familyKey ? TRACK_CATALOG[familyKey] : null;
}

export function getMajorMeta(majorKey) {
  return ACADEMIC_MAJORS.find((m) => m.value === majorKey) ?? null;
}

export function buildJourneyStages(track, totalHours) {
  const allocation = allocateHours(totalHours);
  return [
    {
      ...PROFESSIONAL_FOUNDATION,
      hours: allocation.foundation,
    },
    {
      name: `المحطة ${SPECIALIZATION_STAGE_STYLE.ordinal}: التخصص`,
      title: track.nameEn,
      emoji: SPECIALIZATION_STAGE_STYLE.emoji,
      desc: track.descriptionAr,
      hours: allocation.specialization,
      color: SPECIALIZATION_STAGE_STYLE.color,
      tags: track.skills.slice(0, 6),
      tasks: track.curriculumModules,
    },
    {
      name: `المحطة ${TASKS_STAGE_STYLE.ordinal}: المهام العملية`,
      title: 'Practical Tasks',
      emoji: TASKS_STAGE_STYLE.emoji,
      desc: 'مهام عملية قابلة للتسليم مع مراجعة المشرف.',
      hours: allocation.tasks,
      color: TASKS_STAGE_STYLE.color,
      tags: ['Tickets', 'Evidence', 'Mentor Review'],
      tasks: track.practicalTasks,
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
 * Client-side academic profile validation (mirrors server rules; server remains authoritative).
 * @returns {{ ok: true, profile: object } | { ok: false, errors: Record<string, string> }}
 */
export function validateAcademicProfile(input) {
  const errors = {};
  const universityValue = input.universityValue ?? '';
  const isOtherUniversity = universityValue === OTHER_UNIVERSITY;
  const universityName = (isOtherUniversity ? input.otherUniversityName : input.universityName || universityValue)
    ?.trim?.() || '';
  if (!universityName) {
    errors.university = 'يرجى اختيار الجامعة.';
  }

  const facultyCode = input.facultyCode ?? '';
  const isOtherFaculty = facultyCode === OTHER_FACULTY;
  const facultyName = (isOtherFaculty ? input.otherFacultyName : input.facultyName || '')?.trim?.() || '';
  if (!facultyCode) {
    errors.faculty = 'يرجى اختيار الكلية.';
  } else if (isOtherFaculty && !facultyName) {
    errors.faculty = 'يرجى إدخال اسم الكلية.';
  } else if (!isOtherFaculty && !facultyName) {
    errors.faculty = 'يرجى اختيار الكلية.';
  }

  const majorCode = input.majorCode ?? '';
  if (!majorCode || !MAJOR_TO_TRACK[majorCode]) {
    errors.major = 'يرجى اختيار التخصص.';
  }

  const trainingHours = Number(input.trainingHours);
  if (!isSupportedHours(trainingHours)) {
    errors.hours = 'يرجى تحديد عدد ساعات التدريب.';
  }

  if (Object.keys(errors).length) {
    return { ok: false, errors };
  }

  const trackCode = MAJOR_TO_TRACK[majorCode];
  const track = TRACK_CATALOG[trackCode];
  const major = getMajorMeta(majorCode);

  return {
    ok: true,
    profile: {
      universityId: isOtherUniversity ? null : input.universityId ?? null,
      universityName,
      isOtherUniversity,
      facultyCode: isOtherFaculty ? OTHER_FACULTY : facultyCode,
      facultyName,
      isOtherFaculty,
      majorCode,
      majorLabelAr: major?.label ?? majorCode,
      majorLabelEn: major?.labelEn ?? majorCode,
      trainingHours,
      trackCode,
      trackNameAr: track.nameAr,
      trackNameEn: track.nameEn,
    },
  };
}

export function buildJourneyPlan(selection) {
  const validated = validateAcademicProfile(selection);
  if (!validated.ok) {
    const first = Object.values(validated.errors)[0] || 'بيانات غير مكتملة';
    throw new Error(first);
  }

  const { profile } = validated;
  const track = getTrackForMajor(profile.majorCode);
  if (!track) throw new Error(`Unknown academic major: ${profile.majorCode}`);
  if (!isSupportedHours(profile.trainingHours)) {
    throw new Error(`Unsupported internship hours: ${profile.trainingHours}`);
  }

  const allocation = allocateHours(profile.trainingHours);
  const intensity = getIntensityBand(profile.trainingHours);

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
    previewTasks: track.practicalTasks.slice(0, PRACTICAL_TASKS_PREVIEW_COUNT),
    headline: `${track.nameAr}`,
    subtitle: `${profile.universityName} • ${profile.facultyName} • ${profile.trainingHours} ساعة • ${track.nameEn}`,
    projectSummary: `${track.finalProject} | مخرجات التسليم: ${track.artifacts}`,
    structureSummary: [
      { key: 'foundation', label: 'Professional Foundation', hours: allocation.foundation },
      { key: 'specialization', label: 'Specialized Training', hours: allocation.specialization },
      { key: 'tasks', label: 'Practical Tasks', hours: allocation.tasks },
      { key: 'finalProject', label: 'Final Project / Portfolio', hours: allocation.finalProject },
    ],
  };
}

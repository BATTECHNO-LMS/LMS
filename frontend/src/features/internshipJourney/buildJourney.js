import {
  ALLOCATION_PERCENT,
  COMMON_IT_STAGE,
  FINAL_STAGE,
  HOURS_OPTIONS,
  MODULE_SHARE_PERCENT,
  MODULE_STAGE_STYLES,
  PRACTICAL_TASKS_PREVIEW_COUNT,
  SOFT_SKILLS_STAGE,
  WEEKLY_HOURS_MODEL,
} from './internshipJourney.data.js';
import { MAJOR_TO_TRACK, TRACK_CATALOG } from './internshipJourney.tracks.js';

export function isSupportedHours(hours) {
  return HOURS_OPTIONS.includes(hours);
}

/**
 * Splits the selected total into soft skills / common IT / specialized hours.
 * Rounding is applied to the first two buckets only; specialized hours take the
 * remainder so the three always sum to exactly `totalHours`.
 */
export function allocateHours(totalHours) {
  const softSkills = Math.round((totalHours * ALLOCATION_PERCENT.softSkills) / 100);
  const commonIt = Math.round((totalHours * ALLOCATION_PERCENT.commonIt) / 100);
  const specialized = totalHours - softSkills - commonIt;
  const first = Math.floor((specialized * MODULE_SHARE_PERCENT[0]) / 100);
  const second = Math.floor((specialized * MODULE_SHARE_PERCENT[1]) / 100);
  return {
    total: totalHours,
    softSkills,
    commonIt,
    specialized,
    modules: [first, second, specialized - first - second],
  };
}

export function getTrackFamilyKey(majorKey) {
  return MAJOR_TO_TRACK[majorKey] ?? null;
}

export function getTrackForMajor(majorKey) {
  const familyKey = getTrackFamilyKey(majorKey);
  return familyKey ? TRACK_CATALOG[familyKey] : null;
}

export function buildJourneyStages(track, totalHours) {
  const allocation = allocateHours(totalHours);
  return [
    { ...SOFT_SKILLS_STAGE, hours: allocation.softSkills },
    { ...COMMON_IT_STAGE, hours: allocation.commonIt },
    ...track.modules.map((module, i) => ({
      name: `المحطة ${MODULE_STAGE_STYLES[i].ordinal}: تحدي تخصصك`,
      title: module.title,
      emoji: MODULE_STAGE_STYLES[i].emoji,
      desc: module.desc,
      hours: allocation.modules[i],
      color: MODULE_STAGE_STYLES[i].color,
      tags: module.tags,
      tasks: module.tasks,
    })),
    { ...FINAL_STAGE, hours: 0 },
  ];
}

export function buildJourneyPlan({ university, hours, majorKey }) {
  const track = getTrackForMajor(majorKey);
  if (!track) throw new Error(`Unknown academic major: ${majorKey}`);
  if (!isSupportedHours(hours)) throw new Error(`Unsupported internship hours: ${hours}`);

  const allocation = allocateHours(hours);
  return {
    university,
    hours,
    majorKey,
    track,
    allocation,
    weeks: Math.ceil(hours / WEEKLY_HOURS_MODEL),
    stages: buildJourneyStages(track, hours),
    previewTasks: track.modules.flatMap((m) => m.tasks).slice(0, PRACTICAL_TASKS_PREVIEW_COUNT),
    headline: `رحلة ${track.name} جاهزة! ${track.emoji}`,
    subtitle: `${university} • ${hours} ساعة • ${track.name} • الهدف المهني: ${track.role}`,
    projectSummary:
      `${track.project} | مخرجات التسليم: ${track.artifacts}` + (track.note ? ` | ${track.note}` : ''),
  };
}

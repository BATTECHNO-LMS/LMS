import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  applyDocumentLocale,
  getStoredLocale,
  normalizeLocale,
  setStoredLocale,
} from '../utils/locale.js';

import arCommon from './locales/ar/common.json';
import enCommon from './locales/en/common.json';
import arAuth from './locales/ar/auth.json';
import enAuth from './locales/en/auth.json';
import arDashboard from './locales/ar/dashboard.json';
import enDashboard from './locales/en/dashboard.json';
import arNavigation from './locales/ar/navigation.json';
import enNavigation from './locales/en/navigation.json';
import arUsers from './locales/ar/users.json';
import enUsers from './locales/en/users.json';
import arAssessments from './locales/ar/assessments.json';
import enAssessments from './locales/en/assessments.json';
import arCohorts from './locales/ar/cohorts.json';
import enCohorts from './locales/en/cohorts.json';
import arUniversities from './locales/ar/universities.json';
import enUniversities from './locales/en/universities.json';
import arValidation from './locales/ar/validation.json';
import enValidation from './locales/en/validation.json';
import arEmptyStates from './locales/ar/emptyStates.json';
import enEmptyStates from './locales/en/emptyStates.json';
import arSettings from './locales/ar/settings.json';
import enSettings from './locales/en/settings.json';
import arTracks from './locales/ar/tracks.json';
import enTracks from './locales/en/tracks.json';
import arMicroCredentials from './locales/ar/microCredentials.json';
import enMicroCredentials from './locales/en/microCredentials.json';
import arRecognition from './locales/ar/recognition.json';
import enRecognition from './locales/en/recognition.json';
import arAnalytics from './locales/ar/analytics.json';
import enAnalytics from './locales/en/analytics.json';
import arSubmissions from './locales/ar/submissions.json';
import enSubmissions from './locales/en/submissions.json';
import arGrades from './locales/ar/grades.json';
import enGrades from './locales/en/grades.json';

export const I18N_NAMESPACES = [
  'common',
  'auth',
  'dashboard',
  'navigation',
  'users',
  'assessments',
  'submissions',
  'grades',
  'cohorts',
  'universities',
  'validation',
  'emptyStates',
  'settings',
  'tracks',
  'microCredentials',
  'recognition',
  'analytics',
];

const resources = {
  ar: {
    common: arCommon,
    auth: arAuth,
    dashboard: arDashboard,
    navigation: arNavigation,
    users: arUsers,
    assessments: arAssessments,
    submissions: arSubmissions,
    grades: arGrades,
    cohorts: arCohorts,
    universities: arUniversities,
    validation: arValidation,
    emptyStates: arEmptyStates,
    settings: arSettings,
    tracks: arTracks,
    microCredentials: arMicroCredentials,
    recognition: arRecognition,
    analytics: arAnalytics,
  },
  en: {
    common: enCommon,
    auth: enAuth,
    dashboard: enDashboard,
    navigation: enNavigation,
    users: enUsers,
    assessments: enAssessments,
    submissions: enSubmissions,
    grades: enGrades,
    cohorts: enCohorts,
    universities: enUniversities,
    validation: enValidation,
    emptyStates: enEmptyStates,
    settings: enSettings,
    tracks: enTracks,
    microCredentials: enMicroCredentials,
    recognition: enRecognition,
    analytics: enAnalytics,
  },
};

const initialLng = normalizeLocale(getStoredLocale());

i18n.use(initReactI18next).init({
  resources,
  lng: initialLng,
  fallbackLng: 'ar',
  defaultNS: 'common',
  ns: I18N_NAMESPACES,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

function syncDom(lng) {
  const n = normalizeLocale(lng);
  setStoredLocale(n);
  applyDocumentLocale(n);
}

i18n.on('languageChanged', syncDom);
syncDom(i18n.language);

export default i18n;

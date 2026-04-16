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
import arLearningOutcomes from './locales/ar/learningOutcomes.json';
import enLearningOutcomes from './locales/en/learningOutcomes.json';
import arEnrollments from './locales/ar/enrollments.json';
import enEnrollments from './locales/en/enrollments.json';
import arSessions from './locales/ar/sessions.json';
import enSessions from './locales/en/sessions.json';
import arAttendance from './locales/ar/attendance.json';
import enAttendance from './locales/en/attendance.json';
import arRecognition from './locales/ar/recognition.json';
import enRecognition from './locales/en/recognition.json';
import arAnalytics from './locales/ar/analytics.json';
import enAnalytics from './locales/en/analytics.json';
import arRubrics from './locales/ar/rubrics.json';
import enRubrics from './locales/en/rubrics.json';
import arSubmissions from './locales/ar/submissions.json';
import enSubmissions from './locales/en/submissions.json';
import arGrades from './locales/ar/grades.json';
import enGrades from './locales/en/grades.json';
import arEvidence from './locales/ar/evidence.json';
import enEvidence from './locales/en/evidence.json';
import arQaReviews from './locales/ar/qaReviews.json';
import enQaReviews from './locales/en/qaReviews.json';
import arCorrectiveActions from './locales/ar/correctiveActions.json';
import enCorrectiveActions from './locales/en/correctiveActions.json';
import arRiskCases from './locales/ar/riskCases.json';
import enRiskCases from './locales/en/riskCases.json';
import arIntegrityCases from './locales/ar/integrityCases.json';
import enIntegrityCases from './locales/en/integrityCases.json';
import arCertificates from './locales/ar/certificates.json';
import enCertificates from './locales/en/certificates.json';
import arNotifications from './locales/ar/notifications.json';
import enNotifications from './locales/en/notifications.json';
import arAuditLogs from './locales/ar/auditLogs.json';
import enAuditLogs from './locales/en/auditLogs.json';
import arReports from './locales/ar/reports.json';
import enReports from './locales/en/reports.json';
import arLanding from './locales/ar/landing.json';
import enLanding from './locales/en/landing.json';

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
  'learningOutcomes',
  'enrollments',
  'sessions',
  'attendance',
  'recognition',
  'analytics',
  'rubrics',
  'evidence',
  'qaReviews',
  'correctiveActions',
  'riskCases',
  'integrityCases',
  'certificates',
  'notifications',
  'auditLogs',
  'reports',
  'landing',
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
    learningOutcomes: arLearningOutcomes,
    enrollments: arEnrollments,
    sessions: arSessions,
    attendance: arAttendance,
    recognition: arRecognition,
    analytics: arAnalytics,
    rubrics: arRubrics,
    evidence: arEvidence,
    qaReviews: arQaReviews,
    correctiveActions: arCorrectiveActions,
    riskCases: arRiskCases,
    integrityCases: arIntegrityCases,
    certificates: arCertificates,
    notifications: arNotifications,
    auditLogs: arAuditLogs,
    reports: arReports,
    landing: arLanding,
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
    evidence: enEvidence,
    qaReviews: enQaReviews,
    correctiveActions: enCorrectiveActions,
    riskCases: enRiskCases,
    integrityCases: enIntegrityCases,
    certificates: enCertificates,
    notifications: enNotifications,
    auditLogs: enAuditLogs,
    reports: enReports,
    landing: enLanding,
    cohorts: enCohorts,
    universities: enUniversities,
    validation: enValidation,
    emptyStates: enEmptyStates,
    settings: enSettings,
    tracks: enTracks,
    microCredentials: enMicroCredentials,
    learningOutcomes: enLearningOutcomes,
    enrollments: enEnrollments,
    sessions: enSessions,
    attendance: enAttendance,
    recognition: enRecognition,
    analytics: enAnalytics,
    rubrics: enRubrics,
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

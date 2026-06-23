import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { unwrapApiData } from '../../services/apiHelpers.js';

/**
 * @typedef {Object} LandingProgramStat
 * @property {string} label
 * @property {number} progress
 */

/**
 * @typedef {Object} LandingStatsData
 * @property {number} usersCount
 * @property {number} visitsCount
 * @property {number} universitiesCount
 * @property {number} microCredentialsCount
 * @property {number} cohortsCount
 * @property {number} assessmentsCount
 * @property {number} certificatesCount
 * @property {number} attendanceRate
 * @property {number} sessionsThisWeekCount
 * @property {number} openAssessmentsCount
 * @property {number} issuedCertificatesCount
 * @property {LandingProgramStat[]} activePrograms
 */

/**
 * @returns {Promise<LandingStatsData>}
 */
export async function fetchLandingStats() {
  const res = await apiClient.get(endpoints.public.landingStats);
  return unwrapApiData(res);
}

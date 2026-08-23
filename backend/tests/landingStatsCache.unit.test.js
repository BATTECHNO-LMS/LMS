'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getLandingStats,
  _resetLandingStatsCache,
} = require('../src/modules/public/landingStats.service');

function fakeRepo() {
  let visits = 10;
  let metricCalls = 0;
  return {
    incrementLandingVisits: async () => {
      visits += 1;
      return visits;
    },
    countUsers: async () => {
      metricCalls += 1;
      return 4;
    },
    countUniversities: async () => 1,
    countMicroCredentials: async () => 2,
    countCohorts: async () => 3,
    countAssessments: async () => 5,
    countCertificates: async () => 7,
    getAttendanceRate: async () => 80,
    countSessionsThisWeek: async () => 1,
    countOpenAssessments: async () => 2,
    metricCalls: () => metricCalls,
  };
}

test('landing stats cache reuses metric queries within TTL', async () => {
  _resetLandingStatsCache();
  const repo = fakeRepo();
  const first = await getLandingStats(repo);
  const second = await getLandingStats(repo);
  assert.equal(first.certificatesCount, 7);
  assert.equal(first.issuedCertificatesCount, 7);
  assert.equal(repo.metricCalls(), 1);
  assert.equal(second.visitsCount, first.visitsCount + 1);
  _resetLandingStatsCache();
});

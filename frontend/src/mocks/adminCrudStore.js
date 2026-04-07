import {
  MOCK_USERS,
  MOCK_UNIVERSITIES,
  MOCK_TRACKS,
  MOCK_MICRO_CREDENTIALS,
  MOCK_COHORTS,
  MOCK_ASSESSMENTS,
  MOCK_RECOGNITION,
} from './adminCrud.js';

function uid() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

let users = [...MOCK_USERS];
let universities = [...MOCK_UNIVERSITIES];
let tracks = [...MOCK_TRACKS];
let microCredentials = [...MOCK_MICRO_CREDENTIALS];
let cohorts = [...MOCK_COHORTS];
let assessments = [...MOCK_ASSESSMENTS];
let recognition = [...MOCK_RECOGNITION];

export const adminCrudStore = {
  users: {
    getAll: () => [...users],
    getById: (id) => users.find((x) => String(x.id) === String(id)),
    create: (row) => {
      const next = { ...row, id: uid() };
      users = [...users, next];
      return next;
    },
    update: (id, patch) => {
      users = users.map((x) => (String(x.id) === String(id) ? { ...x, ...patch } : x));
    },
    remove: (id) => {
      users = users.filter((x) => String(x.id) !== String(id));
    },
  },
  universities: {
    getAll: () => [...universities],
    getById: (id) => universities.find((x) => String(x.id) === String(id)),
    create: (row) => {
      const next = { ...row, id: uid(), programs: row.programs ?? 0 };
      universities = [...universities, next];
      return next;
    },
    update: (id, patch) => {
      universities = universities.map((x) => (String(x.id) === String(id) ? { ...x, ...patch } : x));
    },
    remove: (id) => {
      universities = universities.filter((x) => String(x.id) !== String(id));
    },
  },
  tracks: {
    getAll: () => [...tracks],
    getById: (id) => tracks.find((x) => String(x.id) === String(id)),
    create: (row) => {
      const next = { ...row, id: uid(), cohorts: row.cohorts ?? 0 };
      tracks = [...tracks, next];
      return next;
    },
    update: (id, patch) => {
      tracks = tracks.map((x) => (String(x.id) === String(id) ? { ...x, ...patch } : x));
    },
    remove: (id) => {
      tracks = tracks.filter((x) => String(x.id) !== String(id));
    },
  },
  microCredentials: {
    getAll: () => [...microCredentials],
    getById: (id) => microCredentials.find((x) => String(x.id) === String(id)),
    create: (row) => {
      const next = { ...row, id: uid(), cohorts: row.cohorts ?? 0 };
      microCredentials = [...microCredentials, next];
      return next;
    },
    update: (id, patch) => {
      microCredentials = microCredentials.map((x) =>
        String(x.id) === String(id) ? { ...x, ...patch } : x
      );
    },
    remove: (id) => {
      microCredentials = microCredentials.filter((x) => String(x.id) !== String(id));
    },
  },
  cohorts: {
    getAll: () => [...cohorts],
    getById: (id) => cohorts.find((x) => String(x.id) === String(id)),
    create: (row) => {
      const next = { ...row, id: uid() };
      cohorts = [...cohorts, next];
      return next;
    },
    update: (id, patch) => {
      cohorts = cohorts.map((x) => (String(x.id) === String(id) ? { ...x, ...patch } : x));
    },
    remove: (id) => {
      cohorts = cohorts.filter((x) => String(x.id) !== String(id));
    },
  },
  assessments: {
    getAll: () => [...assessments],
    getById: (id) => assessments.find((x) => String(x.id) === String(id)),
    create: (row) => {
      const next = { ...row, id: uid() };
      assessments = [...assessments, next];
      return next;
    },
    update: (id, patch) => {
      assessments = assessments.map((x) => (String(x.id) === String(id) ? { ...x, ...patch } : x));
    },
    remove: (id) => {
      assessments = assessments.filter((x) => String(x.id) !== String(id));
    },
  },
  recognition: {
    getAll: () => [...recognition],
    getById: (id) => recognition.find((x) => String(x.id) === String(id)),
    create: (row) => {
      const next = { ...row, id: uid(), createdAt: row.createdAt ?? new Date().toISOString().slice(0, 10) };
      recognition = [...recognition, next];
      return next;
    },
    update: (id, patch) => {
      recognition = recognition.map((x) => (String(x.id) === String(id) ? { ...x, ...patch } : x));
    },
    remove: (id) => {
      recognition = recognition.filter((x) => String(x.id) !== String(id));
    },
  },
};

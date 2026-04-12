/**
 * Transitional empty in-memory store — no seeded demo rows.
 * Replace usages with React Query + feature services.
 */
function emptyEntity() {
  return {
    getAll: () => [],
    getById: () => undefined,
    create: () => {},
    update: () => {},
    remove: () => {},
  };
}

export const adminCrudStore = {
  users: emptyEntity(),
  universities: emptyEntity(),
  tracks: emptyEntity(),
  microCredentials: emptyEntity(),
  cohorts: emptyEntity(),
  assessments: emptyEntity(),
  recognition: emptyEntity(),
};

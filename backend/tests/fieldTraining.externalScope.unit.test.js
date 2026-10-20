const { isExternalSupervisorRole } = require('../src/modules/fieldTraining/fieldTraining.externalScope');

describe('fieldTraining external supervisor scope', () => {
  test('recognizes external_supervisor role', () => {
    expect(isExternalSupervisorRole({ roles: ['external_supervisor'] })).toBe(true);
    expect(isExternalSupervisorRole({ roles: ['admin'] })).toBe(false);
    expect(isExternalSupervisorRole({ roles: ['super_admin'] })).toBe(false);
  });
});

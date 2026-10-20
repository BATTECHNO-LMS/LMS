'use strict';

const ftAccess = require('../src/modules/fieldTraining/fieldTraining.access');

describe('command center university filter contract', () => {
  test('university-scoped user cannot expand to another university via query', () => {
    const user = {
      userId: 'u1',
      universityId: '11111111-1111-1111-1111-111111111111',
      roles: ['admin'],
    };
    expect(() =>
      ftAccess.resolveApplicationStudentUniversityId(
        user,
        '22222222-2222-2222-2222-222222222222'
      )
    ).toThrow(/university|جامعة|Forbidden/i);
  });
});

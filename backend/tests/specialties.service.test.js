const test = require('node:test');
const assert = require('node:assert');
const { assertActiveSpecialty } = require('../src/modules/specialties/specialties.service');

test('assertActiveSpecialty rejects missing specialty id', async () => {
  await assert.rejects(
    () => assertActiveSpecialty(null),
    (err) => err.statusCode === 400 && err.code === 'SPECIALTY_REQUIRED'
  );
});

const test = require('node:test');
const assert = require('node:assert');
const { extractEmailDomain, emailDomainMatchesAllowed } = require('../src/utils/emailDomain');

test('emailDomainMatchesAllowed accepts exact and subdomain', () => {
  assert.strictEqual(emailDomainMatchesAllowed('ttu.edu.jo', ['ttu.edu.jo']), true);
  assert.strictEqual(emailDomainMatchesAllowed('student.mail.ttu.edu.jo', ['ttu.edu.jo']), true);
  assert.strictEqual(emailDomainMatchesAllowed('gmail.com', ['ttu.edu.jo']), false);
});

test('extractEmailDomain parses student email', () => {
  assert.strictEqual(extractEmailDomain('student1@ttu.edu.jo'), 'ttu.edu.jo');
});

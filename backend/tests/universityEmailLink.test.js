const test = require('node:test');
const assert = require('node:assert');
const { extractEmailDomain, emailDomainMatchesAllowed } = require('../src/utils/emailDomain');

test('emailDomainMatchesAllowed requires an exact listed domain', () => {
  assert.strictEqual(emailDomainMatchesAllowed('ttu.edu.jo', ['ttu.edu.jo']), true);
  assert.strictEqual(emailDomainMatchesAllowed('mail.uni.edu.jo', ['uni.edu.jo']), false);
  assert.strictEqual(emailDomainMatchesAllowed('student.mail.ttu.edu.jo', ['ttu.edu.jo']), false);
  assert.strictEqual(emailDomainMatchesAllowed('gmail.com', ['ttu.edu.jo']), false);
  assert.strictEqual(emailDomainMatchesAllowed('mail.uni.edu.jo', ['mail.uni.edu.jo']), true);
});

test('extractEmailDomain parses student email', () => {
  assert.strictEqual(extractEmailDomain('student1@ttu.edu.jo'), 'ttu.edu.jo');
});

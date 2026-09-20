'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { getR2ClientOptions } = require('../src/shared/storage/providers/r2.provider');

describe('R2 client checksum config', () => {
  it('does not attach default CRC32 checksums to presigned PutObject URLs', () => {
    const options = getR2ClientOptions();
    assert.equal(options.requestChecksumCalculation, 'WHEN_REQUIRED');
    assert.equal(options.responseChecksumValidation, 'WHEN_REQUIRED');
  });
});

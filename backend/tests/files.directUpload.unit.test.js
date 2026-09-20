'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { uploadDirect } = require('../src/modules/files/files.service');

describe('uploadDirect', () => {
  it('rejects a missing file before touching storage', async () => {
    await assert.rejects(
      () => uploadDirect(null, { folder: 'training' }, { userId: 'user-1' }),
      (err) => err.code === 'FILE_VALIDATION_ERROR' && err.statusCode === 400
    );
  });

  it('rejects blocked executable names', async () => {
    await assert.rejects(
      () =>
        uploadDirect(
          {
            buffer: Buffer.from('x'),
            originalname: 'payload.exe',
            mimetype: 'application/pdf',
            size: 1,
          },
          { folder: 'training' },
          { userId: 'user-1' }
        ),
      (err) => err.code === 'FILE_VALIDATION_ERROR'
    );
  });

  it('accepts a PDF even when the browser omits MIME type', async () => {
    await assert.rejects(
      () =>
        uploadDirect(
          {
            buffer: Buffer.from('%PDF-1.4'),
            originalname: 'task.pdf',
            mimetype: '',
            size: 8,
          },
          { folder: 'not-a-folder' },
          { userId: 'user-1' }
        ),
      (err) => err.code === 'FILE_VALIDATION_ERROR'
    );
  });
});

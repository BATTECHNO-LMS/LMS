'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { canAccessFile } = require('../src/modules/files/files.service');

describe('canAccessFile', () => {
  it('does not grant access to every authenticated user for visibility=public', () => {
    const file = { id: 'f1', visibility: 'public', createdById: 'owner-1', userId: 'owner-1' };
    const stranger = { userId: 'other-1', isGlobal: false };
    assert.equal(canAccessFile(file, stranger), false);
  });

  it('allows the owner and global admins', () => {
    const file = { id: 'f1', visibility: 'public', createdById: 'owner-1', userId: 'owner-1' };
    assert.equal(canAccessFile(file, { userId: 'owner-1', isGlobal: false }), true);
    assert.equal(canAccessFile(file, { userId: 'other-1', isGlobal: true }), true);
  });
});

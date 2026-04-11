const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/** @alias comparePassword */
async function verifyPassword(password, storedHash) {
  return comparePassword(password, storedHash);
}

async function comparePassword(password, storedHash) {
  if (!storedHash) return false;
  return bcrypt.compare(password, storedHash);
}

module.exports = { hashPassword, comparePassword, verifyPassword };

/**
 * Prove that prisma migrate deploy alone fails on a truly empty database.
 * Used in CI before db:init-empty. Expects failure (non-zero).
 */
const path = require('path');
const { spawnSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const backendRoot = path.join(__dirname, '..');
const prismaCli = path.join(backendRoot, 'node_modules', 'prisma', 'build', 'index.js');

const result = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
  encoding: 'utf8',
  cwd: backendRoot,
  env: process.env,
  windowsHide: true,
});

const out = `${result.stdout || ''}\n${result.stderr || ''}`;
console.log(out);

// Empty DB without baseline should fail (P3005 if somehow non-empty without history,
// or SQL error on first migration missing enum/type).
if (result.status === 0) {
  console.error('[prove-empty-migrate-fails] Unexpected success — empty migrate deploy should fail without baseline.');
  process.exit(1);
}

console.log(`[prove-empty-migrate-fails] Confirmed deploy failed as expected (exit ${result.status}).`);
process.exit(0);

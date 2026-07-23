'use strict';

/**
 * Production/Docker entry: apply pending Prisma migrations, then start the API.
 * Never creates migrations — only `prisma migrate deploy`.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const backendRoot = path.join(__dirname, '..');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const migrate = spawnSync(npx, ['prisma', 'migrate', 'deploy'], {
  cwd: backendRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: process.env,
});

if (migrate.status !== 0) {
  // eslint-disable-next-line no-console
  console.error('prisma migrate deploy failed; refusing to start API');
  process.exit(migrate.status == null ? 1 : migrate.status);
}

require('../src/server');

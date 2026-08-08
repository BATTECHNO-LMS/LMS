'use strict';

/**
 * Notify institution admins about accounts pending activation > 48h.
 * Usage: node scripts/run-activation-overdue-job.js
 */
const organizationsService = require('../src/modules/organizations/organizations.service');

async function main() {
  const result = await organizationsService.notifyActivationOverdue();
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: true, ...result }));
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

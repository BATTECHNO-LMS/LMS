'use strict';

/**
 * Internal CLI: verify Resend configuration without printing secrets or OTP.
 * Usage: node scripts/probe-email-delivery.js
 * Never expose as a public HTTP route.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { probeEmailDelivery } = require('../src/shared/services/email.service');

(async () => {
  const result = await probeEmailDelivery({ to: 'delivered@resend.dev' });
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.providerCallSuccess ? 0 : 2);
})().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(JSON.stringify({ ok: false, error: String(err?.message || err).slice(0, 200) }));
  process.exit(1);
});

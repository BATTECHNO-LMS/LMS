/**
 * Verify Cloudflare R2 configuration and bucket reachability.
 * Usage: node scripts/r2-health-check.js
 */
const { getProvider } = require('../src/shared/storage/storageProvider');
const { env } = require('../src/config/env');

async function main() {
  const backend = env.STORAGE_BACKEND;
  console.log(`STORAGE_BACKEND=${backend}`);

  if (backend !== 'r2') {
    console.log('R2 health check skipped (STORAGE_BACKEND is not r2).');
    return;
  }

  const provider = getProvider();
  const result = await provider.checkHealth();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

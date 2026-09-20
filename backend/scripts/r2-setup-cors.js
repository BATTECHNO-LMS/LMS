/**
 * Apply CORS policy to the Cloudflare R2 bucket for browser presigned uploads.
 * Uses the same origins as API CORS (built-in production hosts + CORS_ORIGINS).
 *
 * The object-read/write R2 token cannot change bucket CORS (Access Denied).
 * If this script fails, paste the printed JSON into:
 * Cloudflare Dashboard → R2 → bucket → Settings → CORS policy
 *
 * Usage: node scripts/r2-setup-cors.js
 */
const { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } = require('@aws-sdk/client-s3');
const { env } = require('../src/config/env');
const { getBrowserCorsOrigins } = require('../src/config/corsOrigins');

function createR2Client() {
  return new S3Client({
    region: env.R2_REGION || 'auto',
    endpoint: env.R2_ENDPOINT,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  });
}

function buildCorsRules(origins) {
  return [
    {
      AllowedOrigins: origins,
      AllowedMethods: ['GET', 'PUT', 'HEAD'],
      AllowedHeaders: ['*'],
      ExposeHeaders: ['ETag', 'Content-Length', 'Content-Type'],
      MaxAgeSeconds: 3600,
    },
  ];
}

async function main() {
  const missing = [];
  if (!env.R2_ENDPOINT) missing.push('R2_ENDPOINT');
  if (!env.R2_ACCESS_KEY_ID) missing.push('R2_ACCESS_KEY_ID');
  if (!env.R2_SECRET_ACCESS_KEY) missing.push('R2_SECRET_ACCESS_KEY');
  if (!env.R2_BUCKET_NAME) missing.push('R2_BUCKET_NAME');
  if (missing.length) {
    console.error(`R2 is not configured. Missing: ${missing.join(', ')}`);
    process.exit(1);
  }

  const origins = getBrowserCorsOrigins();
  if (!origins.length) {
    console.error('No browser CORS origins configured.');
    process.exit(1);
  }

  const corsRules = buildCorsRules(origins);
  const bucket = env.R2_BUCKET_NAME;
  const policyJson = JSON.stringify({ CORSRules: corsRules }, null, 2);

  console.log(`Applying R2 CORS on bucket "${bucket}" for origins:`);
  origins.forEach((o) => console.log(`  - ${o}`));

  const client = createR2Client();

  try {
    await client.send(
      new PutBucketCorsCommand({
        Bucket: bucket,
        CORSConfiguration: { CORSRules: corsRules },
      })
    );
  } catch (err) {
    const denied = err?.name === 'AccessDenied' || /access denied/i.test(String(err.message || ''));
    if (denied) {
      console.error('\nCould not update bucket CORS: the R2 API token lacks Admin permission.');
      console.error('Paste this policy in Cloudflare Dashboard → R2 → Settings → CORS policy:\n');
      console.error(policyJson);
      process.exit(1);
    }
    throw err;
  }

  const current = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
  console.log('\nCurrent bucket CORS policy:');
  console.log(JSON.stringify(current.CORSRules, null, 2));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

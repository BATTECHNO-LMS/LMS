/**
 * Apply CORS policy to the Cloudflare R2 bucket for browser presigned uploads.
 * Uses the same origins as API CORS (CORS_ORIGINS in .env).
 *
 * Usage: node scripts/r2-setup-cors.js
 */
const { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } = require('@aws-sdk/client-s3');
const { env } = require('../src/config/env');

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

async function main() {
  if (env.STORAGE_BACKEND !== 'r2') {
    console.log('R2 CORS setup skipped (STORAGE_BACKEND is not r2).');
    return;
  }

  const missing = [];
  if (!env.R2_ENDPOINT) missing.push('R2_ENDPOINT');
  if (!env.R2_ACCESS_KEY_ID) missing.push('R2_ACCESS_KEY_ID');
  if (!env.R2_SECRET_ACCESS_KEY) missing.push('R2_SECRET_ACCESS_KEY');
  if (!env.R2_BUCKET_NAME) missing.push('R2_BUCKET_NAME');
  if (missing.length) {
    console.error(`R2 is not configured. Missing: ${missing.join(', ')}`);
    process.exit(1);
  }

  const origins = env.CORS_ORIGINS.filter(Boolean);
  if (!origins.length) {
    console.error('CORS_ORIGINS is empty. Add at least http://localhost:5173 to backend/.env');
    process.exit(1);
  }

  const corsRules = [
    {
      AllowedOrigins: origins,
      AllowedMethods: ['GET', 'PUT', 'HEAD'],
      AllowedHeaders: ['*'],
      ExposeHeaders: ['ETag', 'Content-Length', 'Content-Type'],
      MaxAgeSeconds: 3600,
    },
  ];

  const client = createR2Client();
  const bucket = env.R2_BUCKET_NAME;

  console.log(`Applying R2 CORS on bucket "${bucket}" for origins:`);
  origins.forEach((o) => console.log(`  - ${o}`));

  await client.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: { CORSRules: corsRules },
    })
  );

  const current = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
  console.log('\nCurrent bucket CORS policy:');
  console.log(JSON.stringify(current.CORSRules, null, 2));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

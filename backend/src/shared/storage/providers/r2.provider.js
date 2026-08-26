const {
  S3Client,
  HeadObjectCommand,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { env } = require('../../../config/env');
const { assertSafeStorageKey, PRESIGN_PUT_EXPIRES_SEC, PRESIGN_GET_EXPIRES_SEC } = require('../fileRules');

let _client = null;

function getRequiredR2Config() {
  const missing = [];
  if (!env.R2_ENDPOINT) missing.push('R2_ENDPOINT');
  if (!env.R2_ACCESS_KEY_ID) missing.push('R2_ACCESS_KEY_ID');
  if (!env.R2_SECRET_ACCESS_KEY) missing.push('R2_SECRET_ACCESS_KEY');
  if (!env.R2_BUCKET_NAME) missing.push('R2_BUCKET_NAME');
  return missing;
}

function assertR2Configured() {
  const missing = getRequiredR2Config();
  if (missing.length) {
    throw new Error(`R2 storage is not configured. Missing: ${missing.join(', ')}`);
  }
}

function getClient() {
  assertR2Configured();
  if (!_client) {
    _client = new S3Client({
      region: env.R2_REGION || 'auto',
      endpoint: env.R2_ENDPOINT,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    });
  }
  return _client;
}

function getBucket() {
  return env.R2_BUCKET_NAME;
}

async function objectExists(storageKey) {
  const head = await headObject(storageKey);
  return Boolean(head);
}

async function headObject(storageKey) {
  const key = assertSafeStorageKey(storageKey);
  try {
    const res = await getClient().send(
      new HeadObjectCommand({ Bucket: getBucket(), Key: key })
    );
    return {
      size: Number(res.ContentLength || 0),
      contentType: res.ContentType || null,
    };
  } catch (err) {
    if (err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404) return null;
    throw err;
  }
}

async function deleteObject(storageKey) {
  const key = assertSafeStorageKey(storageKey);
  await getClient().send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
  return true;
}

/**
 * @param {{ storageKey: string, mimeType: string, expiresIn?: number }} params
 */
async function createPresignedPutUrl({ storageKey, mimeType, expiresIn = PRESIGN_PUT_EXPIRES_SEC }) {
  const key = assertSafeStorageKey(storageKey);
  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    ContentType: mimeType,
  });
  const uploadUrl = await getSignedUrl(getClient(), command, { expiresIn });
  return {
    uploadUrl,
    bucket: getBucket(),
    expiresIn,
    requiredHeaders: { 'Content-Type': mimeType },
  };
}

/**
 * @param {{ storageKey: string, expiresIn?: number }} params
 */
async function createPresignedGetUrl({ storageKey, expiresIn = PRESIGN_GET_EXPIRES_SEC }) {
  const key = assertSafeStorageKey(storageKey);
  const command = new GetObjectCommand({ Bucket: getBucket(), Key: key });
  const url = await getSignedUrl(getClient(), command, { expiresIn });
  return { url, expiresIn };
}

async function checkHealth() {
  const missing = getRequiredR2Config();
  if (missing.length) {
    return { ok: false, backend: 'r2', missing };
  }
  try {
    const client = getClient();
    await client.send(new HeadObjectCommand({ Bucket: getBucket(), Key: '__health_probe__' }));
    return { ok: true, backend: 'r2', bucket: getBucket() };
  } catch (err) {
    if (err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404) {
      return { ok: true, backend: 'r2', bucket: getBucket(), note: 'bucket reachable' };
    }
    return { ok: false, backend: 'r2', error: err.message || 'R2 health check failed' };
  }
}

async function getObjectBuffer(storageKey) {
  const key = assertSafeStorageKey(storageKey);
  const res = await getClient().send(
    new GetObjectCommand({ Bucket: getBucket(), Key: key })
  );
  const stream = res.Body;
  if (!stream) throw new Error('Empty object body');
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function putObjectBuffer(storageKey, buffer, mimeType) {
  const key = assertSafeStorageKey(storageKey);
  await getClient().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: buffer,
      ContentType: mimeType || 'application/octet-stream',
    })
  );
  return { size: Buffer.byteLength(buffer) };
}

module.exports = {
  getRequiredR2Config,
  assertR2Configured,
  objectExists,
  headObject,
  deleteObject,
  createPresignedPutUrl,
  createPresignedGetUrl,
  checkHealth,
  getObjectBuffer,
  putObjectBuffer,
};

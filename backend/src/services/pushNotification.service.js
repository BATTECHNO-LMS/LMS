'use strict';

/**
 * Mobile push notification sender (Firebase Cloud Messaging).
 *
 * Disabled by default. Enabling requires BOTH:
 *   - FIREBASE_PUSH_ENABLED=true
 *   - one of: FIREBASE_SERVICE_ACCOUNT_JSON (raw JSON string),
 *             FIREBASE_SERVICE_ACCOUNT_BASE64 (base64-encoded JSON),
 *             GOOGLE_APPLICATION_CREDENTIALS (path to a JSON key file)
 *
 * When disabled, or when credentials are missing/invalid, `isEnabled()` returns
 * false and every send method resolves as a safe no-op. `require`-ing this
 * module must NEVER throw, regardless of environment.
 *
 * Privacy: never log registration tokens or service-account contents. The FCM
 * `data` payload only ever carries an allowlisted, length-capped set of keys.
 */

const GENERIC_ALERT = {
  ar: { title: 'لديك إشعار جديد في منصة BATTECHNO', body: 'اضغط لعرض التفاصيل داخل التطبيق.' },
  en: { title: 'You have a new notification', body: 'Open the app to view the details.' },
};

const EVENT_VERSION = '1';
const MAX_DATA_VALUE_LENGTH = 500;

let firebaseAdmin = null;
let firebaseApp = null;
let initAttempted = false;
let enabled = false;
let initError = null;

function readServiceAccountCredential() {
  const rawJson = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  if (rawJson) {
    return { source: 'json', value: JSON.parse(rawJson) };
  }
  const base64Json = (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || '').trim();
  if (base64Json) {
    const decoded = Buffer.from(base64Json, 'base64').toString('utf8');
    return { source: 'base64', value: JSON.parse(decoded) };
  }
  const credentialsPath = (process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim();
  if (credentialsPath) {
    // Let firebase-admin/application-default resolve the file; presence check only.
    return { source: 'path', value: credentialsPath };
  }
  return null;
}

/** Lazy, memoized initialization. Safe to call repeatedly; never throws. */
function ensureInitialized() {
  if (initAttempted) return;
  initAttempted = true;

  const pushEnabledFlag = String(process.env.FIREBASE_PUSH_ENABLED || '').trim().toLowerCase();
  if (pushEnabledFlag !== 'true' && pushEnabledFlag !== '1') {
    enabled = false;
    return;
  }

  try {
    const credential = readServiceAccountCredential();
    if (!credential) {
      enabled = false;
      initError = 'no_credentials_configured';
      return;
    }

    // eslint-disable-next-line global-require
    firebaseAdmin = require('firebase-admin');

    if (credential.source === 'path') {
      firebaseApp = firebaseAdmin.apps.length
        ? firebaseAdmin.app()
        : firebaseAdmin.initializeApp({ credential: firebaseAdmin.credential.applicationDefault() });
    } else {
      const serviceAccount = credential.value;
      if (!serviceAccount || !serviceAccount.project_id || !serviceAccount.private_key) {
        throw new Error('service_account_missing_required_fields');
      }
      firebaseApp = firebaseAdmin.apps.length
        ? firebaseAdmin.app()
        : firebaseAdmin.initializeApp({
            credential: firebaseAdmin.credential.cert(serviceAccount),
          });
    }
    enabled = true;
  } catch (err) {
    // Never leak credential contents in the error message.
    enabled = false;
    initError = err && err.message ? String(err.message).slice(0, 200) : 'init_failed';
    firebaseAdmin = null;
    firebaseApp = null;
    // eslint-disable-next-line no-console
    console.warn('[pushNotification.service] Firebase push disabled:', initError);
  }
}

function isEnabled() {
  ensureInitialized();
  return enabled;
}

function truncate(value, max = MAX_DATA_VALUE_LENGTH) {
  if (value == null) return '';
  const str = String(value);
  return str.length > max ? str.slice(0, max) : str;
}

/**
 * Privacy-allowlisted `data` payload — no free-text title/body/user content here.
 */
function buildDataPayload({ notificationId, type, actionUrl }) {
  return {
    notification_id: truncate(notificationId, 64),
    notification_type: truncate(type || 'info', 64),
    action_url: truncate(actionUrl || '', 2000),
    event_version: EVENT_VERSION,
  };
}

/**
 * Lock-screen visible alert. LMS notification titles/bodies are already
 * privacy-conscious (no PII, grades, or secrets), so they are used as-is by
 * default. Set PUSH_GENERIC_LOCK_SCREEN=true to force a generic locale-aware
 * alert instead (e.g. for stricter deployments).
 */
function buildAlertPayload({ title, body, locale }) {
  const forceGeneric = String(process.env.PUSH_GENERIC_LOCK_SCREEN || '').trim().toLowerCase() === 'true';
  if (!forceGeneric && (title || body)) {
    return { title: truncate(title || GENERIC_ALERT.en.title, 200), body: truncate(body || '', 500) };
  }
  const lang = String(locale || '').toLowerCase().startsWith('ar') ? 'ar' : 'en';
  return GENERIC_ALERT[lang];
}

function isPermanentTokenError(err) {
  const code = err && err.code;
  return (
    code === 'messaging/registration-token-not-registered' ||
    code === 'messaging/invalid-argument' ||
    code === 'messaging/invalid-registration-token'
  );
}

async function disableRegistration(id) {
  try {
    // Lazy require avoids a hard dependency cycle at module load time.
    const repo = require('../modules/mobilePush/mobilePush.repository');
    await repo.disableById(id);
  } catch (_err) {
    // Best-effort; never throw from cleanup path.
  }
}

async function recordDeliveryError(id, message) {
  try {
    const repo = require('../modules/mobilePush/mobilePush.repository');
    await repo.recordDeliveryError(id, message);
  } catch (_err) {
    // Best-effort.
  }
}

/**
 * Send to a single registration row. Resolves to a result object; never throws.
 * @param {{ id: string, registration_token: string, locale?: string|null }} registration
 * @param {{ notificationId: string, title?: string, body?: string, actionUrl?: string|null, type?: string }} payload
 */
async function sendToRegistration(registration, payload) {
  if (!isEnabled()) return { ok: false, reason: 'disabled' };
  if (!registration || !registration.registration_token) return { ok: false, reason: 'no_token' };

  const alert = buildAlertPayload({ title: payload.title, body: payload.body, locale: registration.locale });
  const data = buildDataPayload({
    notificationId: payload.notificationId,
    type: payload.type,
    actionUrl: payload.actionUrl,
  });

  try {
    await firebaseAdmin.messaging().send({
      token: registration.registration_token,
      notification: alert,
      data,
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    });
    return { ok: true };
  } catch (err) {
    const code = err && err.code;
    if (isPermanentTokenError(err)) {
      await disableRegistration(registration.id);
      return { ok: false, reason: code || 'permanent_error' };
    }
    await recordDeliveryError(registration.id, code || err?.message || 'send_failed');
    return { ok: false, reason: code || 'temporary_error' };
  }
}

/** Send by raw token (no registration id — used for one-off / test sends). */
async function sendToToken(token, payload) {
  if (!isEnabled()) return { ok: false, reason: 'disabled' };
  if (!token) return { ok: false, reason: 'no_token' };

  const alert = buildAlertPayload({ title: payload.title, body: payload.body, locale: payload.locale });
  const data = buildDataPayload({
    notificationId: payload.notificationId,
    type: payload.type,
    actionUrl: payload.actionUrl,
  });

  try {
    await firebaseAdmin.messaging().send({ token, notification: alert, data });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: (err && err.code) || 'send_failed' };
  }
}

/**
 * Fan out to every active (non-disabled) registration for a user.
 * Always resolves — a push failure must never affect the caller (e.g. notification creation).
 */
async function sendToUser(userId, payload) {
  if (!userId || !isEnabled()) return { ok: false, reason: !userId ? 'no_user' : 'disabled', sent: 0 };

  try {
    const repo = require('../modules/mobilePush/mobilePush.repository');
    const registrations = await repo.findActiveByUserId(userId);
    if (!registrations.length) return { ok: true, sent: 0 };

    const results = await Promise.all(
      registrations.map((registration) => sendToRegistration(registration, payload))
    );
    const sent = results.filter((r) => r.ok).length;
    return { ok: true, sent, total: registrations.length };
  } catch (_err) {
    return { ok: false, reason: 'lookup_failed', sent: 0 };
  }
}

/** Test-only: reset memoized init state so tests can exercise different env combinations. */
function _resetForTests() {
  firebaseAdmin = null;
  firebaseApp = null;
  initAttempted = false;
  enabled = false;
  initError = null;
}

module.exports = {
  isEnabled,
  sendToUser,
  sendToToken,
  disableRegistration,
  buildDataPayload,
  buildAlertPayload,
  _resetForTests,
};

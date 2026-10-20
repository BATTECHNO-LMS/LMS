/**
 * Field Training QR attendance — challenge binding & rotation (no DB).
 */

const crypto = require('crypto');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-ft-qr-secret';
process.env.ATTENDANCE_QR_ROTATION_SECONDS = '45';

const qr = require('../src/modules/fieldTraining/fieldTraining.qrAttendance.service');

describe('fieldTraining QR attendance challenges', () => {
  const windowId = '11111111-1111-1111-1111-111111111111';
  const sessionId = '22222222-2222-2222-2222-222222222222';

  test('QR payload has no JWT shape and binds window+session', () => {
    const windowRow = { id: windowId, session_id: sessionId, status: 'open' };
    const built = qr.buildQrChallengeForWindow(windowRow);
    expect(built.token).toBeTruthy();
    expect(built.token.split('.').length).not.toBe(3); // not JWT
    const decoded = qr.decodeQrPayload(built.token);
    expect(decoded.windowId).toBe(windowId);
    expect(decoded.sessionId).toBe(sessionId);
    expect(decoded.challenge).toBeTruthy();
  });

  test('valid current slot verifies; wrong session denied', () => {
    const windowRow = { id: windowId, session_id: sessionId, status: 'open' };
    const built = qr.buildQrChallengeForWindow(windowRow);
    const payload = qr.decodeQrPayload(built.token);
    expect(qr.verifyChallengeAgainstWindow(payload, windowRow).ok).toBe(true);

    const wrongSession = { ...windowRow, session_id: '33333333-3333-3333-3333-333333333333' };
    expect(qr.verifyChallengeAgainstWindow(payload, wrongSession).ok).toBe(false);
    expect(qr.verifyChallengeAgainstWindow(payload, wrongSession).reason).toBe('wrong_session');
  });

  test('expired slot (old rotation) is denied', () => {
    const windowRow = { id: windowId, session_id: sessionId, status: 'open' };
    const oldSlot = qr.currentSlot() - 5;
    const challenge = qr.hmacChallenge(windowId, sessionId, oldSlot);
    const token = qr.encodeQrPayload({
      windowId,
      sessionId,
      slot: oldSlot,
      challenge,
    });
    const payload = qr.decodeQrPayload(token);
    const result = qr.verifyChallengeAgainstWindow(payload, windowRow);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('expired_challenge');
  });

  test('tampered HMAC fails', () => {
    const windowRow = { id: windowId, session_id: sessionId, status: 'open' };
    const built = qr.buildQrChallengeForWindow(windowRow);
    const payload = qr.decodeQrPayload(built.token);
    payload.challenge = crypto.randomBytes(16).toString('base64url');
    expect(qr.verifyChallengeAgainstWindow(payload, windowRow).ok).toBe(false);
  });

  test('rotation interval is configurable via env', () => {
    expect(qr.rotationSeconds()).toBe(45);
  });
});

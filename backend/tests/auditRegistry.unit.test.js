'use strict';

/**
 * Static guarantees for the central audit action registry:
 *  - every action code emitted from backend source is registered (category + labels)
 *  - action codes never embed person names / emails
 *  - never-audit noise (keystrokes, mouse, heartbeats, polling, SSE) has no action code
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  AUDIT_ACTIONS,
  AUDIT_CATEGORIES,
  CATEGORY_LABELS,
  NAVIGATION_ACTIONS,
  SESSION_END_REASONS,
  isRegisteredAuditAction,
} = require('../src/shared/audit/auditActions');

const SRC = path.join(__dirname, '..', 'src');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

const ACTION_LITERAL_RES = [
  /actionType\s*:\s*['"`]([A-Za-z0-9_.:-]+)['"`]/g,
  /action_type\s*:\s*['"`]([A-Za-z0-9_.:-]+)['"`]/g,
];

function collectEmittedActions() {
  const found = new Map();
  for (const file of walk(SRC)) {
    if (file.includes(`${path.sep}audit-logs${path.sep}`) || file.endsWith('auditActions.js')) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const re of ACTION_LITERAL_RES) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text))) {
        if (!found.has(m[1])) found.set(m[1], path.relative(SRC, file));
      }
    }
  }
  return found;
}

describe('audit action registry', () => {
  it('every registered action has a valid category and Arabic + English labels', () => {
    for (const [code, meta] of Object.entries(AUDIT_ACTIONS)) {
      assert.ok(AUDIT_CATEGORIES[meta.category], `${code} category`);
      assert.ok(CATEGORY_LABELS[meta.category]?.ar, `${code} category label`);
      assert.ok(meta.labelAr && /[\u0600-\u06FF]/.test(meta.labelAr), `${code} Arabic label`);
      assert.ok(meta.labelEn, `${code} English label`);
    }
  });

  it('every action code emitted from source is registered', () => {
    const emitted = collectEmittedActions();
    assert.ok(emitted.size > 50, `scanner found ${emitted.size} actions`);
    const missing = [...emitted.entries()].filter(([code]) => !isRegisteredAuditAction(code));
    assert.deepEqual(missing, [], `unregistered actions: ${JSON.stringify(missing)}`);
  });

  it('action codes are stable identifiers without names or emails', () => {
    for (const code of Object.keys(AUDIT_ACTIONS)) {
      assert.match(code, /^[A-Za-z0-9_.:-]+$/, code);
      assert.doesNotMatch(code, /@/, code);
      assert.ok(code.length <= 80, code);
    }
  });

  it('required auth/session events exist in the AUTH category', () => {
    for (const code of [
      'USER_LOGIN_SUCCESS',
      'USER_LOGIN_FAILED',
      'AUTH_SESSION_CREATED',
      'AUTH_SESSION_ACTIVITY_STARTED',
      'AUTH_SESSION_IDLE_TIMEOUT',
      'AUTH_SESSION_ENDED',
      'USER_LOGOUT',
      'TOKEN_INVALID',
      'TOKEN_EXPIRED',
      'LOGIN_ACCOUNT_DENIED',
    ]) {
      assert.ok(AUDIT_ACTIONS[code], code);
      assert.ok(['AUTH', 'SECURITY'].includes(AUDIT_ACTIONS[code].category), code);
    }
    assert.deepEqual(Object.keys(SESSION_END_REASONS).sort(), [
      'ABSOLUTE_EXPIRY',
      'ADMIN_REVOKED',
      'IDLE_TIMEOUT',
      'USER_LOGOUT',
    ]);
  });

  it('navigation events are registered; noise is not', () => {
    for (const action of Object.values(NAVIGATION_ACTIONS)) assert.ok(AUDIT_ACTIONS[action], action);
    const noise = new Set(['KEYSTROKE', 'KEYPRESS', 'MOUSE', 'SCROLL', 'HEARTBEAT', 'POLL', 'POLLING', 'SSE', 'CLIPBOARD', 'SCREENSHOT', 'RENDER']);
    for (const code of Object.keys(AUDIT_ACTIONS)) {
      const tokens = code.toUpperCase().split(/[_.:-]/);
      assert.equal(tokens.some((t) => noise.has(t)), false, code);
    }
  });

  it('recorded-lecture heartbeats are not audited (only started/completed milestones)', () => {
    const heartbeatFiles = walk(SRC).filter((f) => /recordedLectures?\.(watch|heartbeat)/i.test(path.basename(f)));
    for (const file of heartbeatFiles) {
      const text = fs.readFileSync(file, 'utf8');
      const actions = [...text.matchAll(/actionType\s*:\s*'([A-Z_]+)'/g)].map((m) => m[1]);
      for (const a of actions) assert.match(a, /^RECORDED_LECTURE_(STARTED|COMPLETED)$/, `${path.basename(file)}: ${a}`);
    }
  });
});

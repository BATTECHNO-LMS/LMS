'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const proxyaddr = require('proxy-addr');
const { resolveTrustProxyConfig, buildTrustProxyFn } = require('../src/config/trustProxy');
const {
  normalizeIp,
  getSecurityClientIp,
  isFromTrustedProxy,
  clientIpRateLimitKey,
} = require('../src/shared/security/clientIdentity');

const PRODUCTION = buildTrustProxyFn(resolveTrustProxyConfig({ TRUST_PROXY: 'true' }));
const DEVELOPMENT = buildTrustProxyFn(resolveTrustProxyConfig({}));

/** Docker bridge gateway as appended by the frontend container nginx. */
const DOCKER_GATEWAY = '172.18.0.1';

function fakeReq(remoteAddress, xff) {
  const socket = { remoteAddress };
  return { connection: socket, socket, headers: xff === undefined ? {} : { 'x-forwarded-for': xff } };
}

function appWith(trust) {
  const app = express();
  app.set('trust proxy', trust);
  app.get('/whoami', (req, res) => {
    res.json({
      reqIp: req.ip,
      clientIp: getSecurityClientIp(req),
      trustedPeer: isFromTrustedProxy(req),
      bucket: clientIpRateLimitKey(req),
    });
  });
  return app;
}

describe('trust proxy configuration', () => {
  it('production TRUST_PROXY=true trusts private proxies for exactly two hops', () => {
    assert.deepEqual(resolveTrustProxyConfig({ TRUST_PROXY: 'true' }), {
      subnets: ['loopback', 'uniquelocal'],
      hops: 2,
    });
  });

  it('unset TRUST_PROXY trusts only the local loopback proxy (one hop)', () => {
    assert.deepEqual(resolveTrustProxyConfig({}), { subnets: ['loopback'], hops: 1 });
    assert.deepEqual(resolveTrustProxyConfig({ TRUST_PROXY: 'false' }), { subnets: ['loopback'], hops: 1 });
  });

  it('honours explicit hop / subnet overrides and rejects invalid hop counts', () => {
    assert.deepEqual(resolveTrustProxyConfig({ TRUST_PROXY: 'true', TRUST_PROXY_HOPS: '1' }).hops, 1);
    assert.deepEqual(resolveTrustProxyConfig({ TRUST_PROXY: '10.1.0.0/16' }).subnets, ['10.1.0.0/16']);
    assert.throws(() => resolveTrustProxyConfig({ TRUST_PROXY: 'true', TRUST_PROXY_HOPS: '0' }));
    assert.throws(() => resolveTrustProxyConfig({ TRUST_PROXY: 'true', TRUST_PROXY_HOPS: '99' }));
    assert.throws(() => resolveTrustProxyConfig({ TRUST_PROXY: 'true', TRUST_PROXY_HOPS: 'abc' }));
  });

  it('never trusts every hop (trust proxy = true equivalent)', () => {
    assert.equal(typeof PRODUCTION, 'function');
    assert.equal(PRODUCTION('127.0.0.1', 0), true);
    assert.equal(PRODUCTION('172.18.0.1', 1), true);
    assert.equal(PRODUCTION('172.18.0.1', 2), false, 'third hop is never trusted');
    assert.equal(PRODUCTION('203.0.113.10', 0), false, 'public peers are never proxies');
  });
});

describe('client IP resolution (proxy chain)', () => {
  it('host nginx → container nginx → Express resolves the public client IPv4', () => {
    const req = fakeReq('172.18.0.3', `203.0.113.10, ${DOCKER_GATEWAY}`);
    assert.equal(proxyaddr(req, PRODUCTION), '203.0.113.10');
  });

  it('a different client behind the same proxies resolves to its own IP', () => {
    const req = fakeReq('172.18.0.3', `198.51.100.22, ${DOCKER_GATEWAY}`);
    assert.equal(proxyaddr(req, PRODUCTION), '198.51.100.22');
  });

  it('spoofed X-Forwarded-For entries to the left are ignored', () => {
    const req = fakeReq('172.18.0.3', `1.2.3.4, 203.0.113.10, ${DOCKER_GATEWAY}`);
    assert.equal(proxyaddr(req, PRODUCTION), '203.0.113.10');
  });

  it('a client inside a private range cannot spoof past the hop cap', () => {
    const req = fakeReq('172.18.0.3', `1.2.3.4, 10.0.0.5, ${DOCKER_GATEWAY}`);
    assert.equal(proxyaddr(req, PRODUCTION), '10.0.0.5');
  });

  it('IPv6 clients resolve correctly', () => {
    const req = fakeReq('172.18.0.3', `2001:db8::1, ${DOCKER_GATEWAY}`);
    assert.equal(proxyaddr(req, PRODUCTION), '2001:db8::1');
  });

  it('a direct public peer is the client even if it sends X-Forwarded-For', () => {
    const req = fakeReq('198.51.100.22', '1.2.3.4');
    assert.equal(proxyaddr(req, PRODUCTION), '198.51.100.22');
    assert.equal(proxyaddr(req, DEVELOPMENT), '198.51.100.22');
  });

  it('missing X-Forwarded-For falls back to the socket peer', () => {
    assert.equal(proxyaddr(fakeReq('172.18.0.3'), PRODUCTION), '172.18.0.3');
  });

  it('a malformed left-most value is never selected behind a valid client entry', () => {
    const req = fakeReq('172.18.0.3', `not-an-ip, 203.0.113.10, ${DOCKER_GATEWAY}`);
    assert.equal(proxyaddr(req, PRODUCTION), '203.0.113.10');
  });
});

describe('getSecurityClientIp / normalizeIp', () => {
  it('normalizes IPv4-mapped IPv6 and rejects garbage', () => {
    assert.equal(normalizeIp('::ffff:203.0.113.10'), '203.0.113.10');
    assert.equal(normalizeIp(' 2001:db8::1 '), '2001:db8::1');
    assert.equal(normalizeIp('not-an-ip'), null);
    assert.equal(normalizeIp('203.0.113.10, 1.2.3.4'), null);
    assert.equal(normalizeIp(''), null);
    assert.equal(normalizeIp(undefined), null);
  });

  it('a malformed req.ip falls back to the socket peer, never to the raw value', () => {
    const ip = getSecurityClientIp({ ip: '<script>', socket: { remoteAddress: '::ffff:127.0.0.1' } });
    assert.equal(ip, '127.0.0.1');
  });

  it('IPv6 rate-limit keys are grouped per /56 network', () => {
    const a = clientIpRateLimitKey({ ip: '2001:db8:0:1::1' });
    const b = clientIpRateLimitKey({ ip: '2001:db8:0:2::9' });
    const c = clientIpRateLimitKey({ ip: '2001:db8:1:100::1' });
    assert.equal(a, b);
    assert.notEqual(a, c);
    assert.equal(clientIpRateLimitKey({}), 'ip:unknown');
  });
});

describe('Express integration (real request through the trust function)', () => {
  it('production chain: supertest loopback peer + gateway → public client', async () => {
    const res = await request(appWith(PRODUCTION))
      .get('/whoami')
      .set('X-Forwarded-For', `9.9.9.9, 203.0.113.10, ${DOCKER_GATEWAY}`);
    assert.equal(res.body.clientIp, '203.0.113.10');
    assert.equal(res.body.trustedPeer, true);
  });

  it('development: Vite proxy on loopback forwards the browser address', async () => {
    const res = await request(appWith(DEVELOPMENT)).get('/whoami').set('X-Forwarded-For', '198.51.100.22');
    assert.equal(res.body.clientIp, '198.51.100.22');
  });

  it('development: only one hop is trusted (spoofed extra hops ignored)', async () => {
    const res = await request(appWith(DEVELOPMENT))
      .get('/whoami')
      .set('X-Forwarded-For', '1.2.3.4, 198.51.100.22');
    assert.equal(res.body.clientIp, '198.51.100.22');
  });

  it('no forwarding header: the loopback peer itself', async () => {
    const res = await request(appWith(PRODUCTION)).get('/whoami');
    assert.ok(['127.0.0.1', '::1'].includes(res.body.clientIp), res.body.clientIp);
  });
});

describe('static guard: no hand-parsed forwarding headers in application code', () => {
  it('X-Forwarded-For / X-Real-IP are only read through Express trust proxy', () => {
    const fs = require('fs');
    const path = require('path');
    const root = path.join(__dirname, '..', 'src');
    const offenders = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.js')) {
          const text = fs.readFileSync(full, 'utf8');
          if (/headers\s*\[\s*['"]x-(forwarded-for|real-ip)['"]\s*\]|get\(\s*['"]x-(forwarded-for|real-ip)['"]/i.test(text)) {
            offenders.push(path.relative(root, full));
          }
        }
      }
    };
    walk(root);
    assert.deepEqual(offenders, []);
  });
});

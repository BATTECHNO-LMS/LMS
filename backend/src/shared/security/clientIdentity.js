'use strict';

const net = require('net');
const { ipKeyGenerator } = require('express-rate-limit');

/**
 * Canonical security identity of the HTTP client.
 *
 * `req.ip` is computed by Express from the socket peer and X-Forwarded-For using the
 * hop-capped trusted-proxy function (config/trustProxy). Never parse X-Forwarded-For /
 * X-Real-IP by hand anywhere else: those headers are attacker-controlled.
 */

function normalizeIp(value) {
  if (typeof value !== 'string') return null;
  let ip = value.trim();
  if (!ip) return null;
  if (ip.toLowerCase().startsWith('::ffff:') && net.isIPv4(ip.slice(7))) ip = ip.slice(7);
  return net.isIP(ip) ? ip.slice(0, 64) : null;
}

/** @param {import('express').Request} req */
function getSecurityClientIp(req) {
  return normalizeIp(req?.ip) || normalizeIp(req?.socket?.remoteAddress) || null;
}

/** Whether the immediate TCP peer is one of our trusted reverse proxies. */
function isFromTrustedProxy(req) {
  const trust = req?.app?.get?.('trust proxy fn');
  const peer = req?.socket?.remoteAddress;
  return Boolean(typeof trust === 'function' && peer && trust(peer, 0));
}

/** Rate-limit bucket key for the client address (IPv6 grouped per /56 by express-rate-limit). */
function clientIpRateLimitKey(req) {
  const ip = getSecurityClientIp(req);
  return ip ? ipKeyGenerator(ip) : 'ip:unknown';
}

module.exports = { normalizeIp, getSecurityClientIp, isFromTrustedProxy, clientIpRateLimitKey };

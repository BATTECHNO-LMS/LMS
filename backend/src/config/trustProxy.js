'use strict';

// Express 4 compiles `trust proxy` with proxy-addr; using it directly keeps semantics identical.
const proxyaddr = require('proxy-addr');

const DEFAULT_PROXY_SUBNETS = 'loopback,uniquelocal';
const DEFAULT_PRODUCTION_HOPS = 2;
const MAX_HOPS = 5;

function parseSubnets(raw, fallback) {
  const list = String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : fallback.split(',');
}

function parseHops(raw, fallback) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > MAX_HOPS) {
    throw new Error(`TRUST_PROXY_HOPS must be an integer between 1 and ${MAX_HOPS}`);
  }
  return n;
}

/**
 * Resolve which reverse proxies Express may believe about the client address.
 *
 * An address is treated as a proxy only when BOTH hold:
 *   - it is one of the first `hops` addresses walking back from the socket
 *     (socket peer = hop 1, right-most X-Forwarded-For entry = hop 2, ...), and
 *   - it is inside a trusted subnet (loopback / private Docker bridge by default).
 * The first address failing either test is the client. A client can prepend anything to
 * X-Forwarded-For, but cannot change the entries appended by our own proxies, so spoofed
 * values always sit to the left of the real client address and are never reached.
 *
 * Env:
 *   TRUST_PROXY          unset/false → local dev: loopback only, 1 hop (Vite proxy)
 *                        true/1      → production chain: host nginx → container nginx → Express
 *                        <integer>   → that many hops inside the trusted subnets
 *                        <csv>       → explicit trusted subnets / names
 *   TRUST_PROXY_HOPS     overrides the hop cap (1..5); production default 2
 *   TRUST_PROXY_SUBNETS  overrides trusted subnets; default "loopback,uniquelocal"
 *
 * @param {Record<string, string | undefined>} vars
 */
function resolveTrustProxyConfig(vars = process.env) {
  const raw = typeof vars.TRUST_PROXY === 'string' ? vars.TRUST_PROXY.trim() : '';
  let subnets;
  let hops;
  if (!raw || raw === 'false' || raw === '0') {
    subnets = parseSubnets(vars.TRUST_PROXY_SUBNETS, 'loopback');
    hops = parseHops(vars.TRUST_PROXY_HOPS, 1);
  } else if (raw === 'true' || raw === '1') {
    subnets = parseSubnets(vars.TRUST_PROXY_SUBNETS, DEFAULT_PROXY_SUBNETS);
    hops = parseHops(vars.TRUST_PROXY_HOPS, DEFAULT_PRODUCTION_HOPS);
  } else if (/^\d+$/.test(raw)) {
    subnets = parseSubnets(vars.TRUST_PROXY_SUBNETS, DEFAULT_PROXY_SUBNETS);
    hops = parseHops(vars.TRUST_PROXY_HOPS ?? raw, DEFAULT_PRODUCTION_HOPS);
  } else {
    subnets = parseSubnets(raw, DEFAULT_PROXY_SUBNETS);
    hops = parseHops(vars.TRUST_PROXY_HOPS, DEFAULT_PRODUCTION_HOPS);
  }
  return { subnets, hops };
}

/**
 * @param {{ subnets: string[], hops: number }} config
 * @returns {(addr: string, index: number) => boolean}
 */
function buildTrustProxyFn(config) {
  const inTrustedSubnet = proxyaddr.compile(config.subnets);
  const hops = config.hops;
  const trustFn = (addr, index) => index < hops && inTrustedSubnet(addr, index);
  Object.defineProperty(trustFn, 'description', {
    value: `subnets=${config.subnets.join(',')} hops=${hops}`,
  });
  return trustFn;
}

module.exports = { resolveTrustProxyConfig, buildTrustProxyFn, DEFAULT_PROXY_SUBNETS, DEFAULT_PRODUCTION_HOPS };

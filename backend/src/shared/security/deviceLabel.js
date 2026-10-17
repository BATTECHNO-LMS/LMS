'use strict';

/**
 * Human-readable, coarse session descriptors for the owner's "Security & sessions" page.
 * Deliberately low-resolution: browser family + OS family and a truncated IP — no
 * fingerprinting, no versions, no raw user-agent sent back to the browser.
 */

const BROWSERS = [
  ['Edge', /\bEdg(?:e|A|iOS)?\//],
  ['Opera', /\bOPR\/|\bOpera\b/],
  ['Samsung Internet', /\bSamsungBrowser\//],
  ['Firefox', /\bFirefox\/|\bFxiOS\//],
  ['Chrome', /\bChrome\/|\bCriOS\//],
  ['Safari', /\bSafari\//],
];

const SYSTEMS = [
  ['iPhone', /\biPhone\b/],
  ['iPad', /\biPad\b/],
  ['Android', /\bAndroid\b/],
  ['Windows', /\bWindows\b/],
  ['ChromeOS', /\bCrOS\b/],
  ['macOS', /\bMac OS X\b|\bMacintosh\b/],
  ['Linux', /\bLinux\b/],
];

function pick(list, ua) {
  for (const [name, re] of list) if (re.test(ua)) return name;
  return null;
}

/** @returns {{ browser: string|null, os: string|null, label: string|null }} */
function describeUserAgent(userAgent) {
  const ua = typeof userAgent === 'string' ? userAgent.slice(0, 512) : '';
  if (!ua) return { browser: null, os: null, label: null };
  const browser = pick(BROWSERS, ua);
  const os = pick(SYSTEMS, ua);
  const label = browser && os ? `${browser} on ${os}` : browser || os || null;
  return { browser, os, label };
}

/** IPv4 → "203.0.113.x"; IPv6 → first three groups + "::"; anything else → null. */
function maskIpAddress(ip) {
  if (typeof ip !== 'string' || !ip.trim()) return null;
  let s = ip.trim();
  if (s.startsWith('::ffff:') && s.includes('.')) s = s.slice(7);
  const v4 = s.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) return `${v4[1]}.${v4[2]}.${v4[3]}.x`;
  if (s.includes(':')) {
    const groups = s.split('::')[0].split(':').filter(Boolean).slice(0, 3);
    return groups.length ? `${groups.join(':')}::` : null;
  }
  return null;
}

module.exports = { describeUserAgent, maskIpAddress };

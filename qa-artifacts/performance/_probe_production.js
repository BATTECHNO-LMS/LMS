'use strict';

/**
 * Read-only production probe. No credentials. No mutations.
 * Writes JSON/text under qa-artifacts/performance/
 */

const dns = require('dns').promises;
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const { performance } = require('perf_hooks');
const tls = require('tls');
const { URL } = require('url');

const OUT = path.resolve(__dirname);
const HOST = 'lms.battechno.com';
const EXPECTED_IP = '187.55.228.232';
const ORIGIN = 'https://lms.battechno.com';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function redactHeaders(headers) {
  const h = { ...headers };
  for (const k of Object.keys(h)) {
    if (/cookie|authorization|set-cookie|secret|token/i.test(k)) h[k] = '[redacted]';
  }
  return h;
}

function requestOnce(urlStr, { method = 'GET', timeoutMs = 25000, headers = {}, agent } = {}) {
  return new Promise((resolve) => {
    const u = new URL(urlStr);
    const lib = u.protocol === 'https:' ? https : http;
    const started = performance.now();
    let ttfb = null;
    const req = lib.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        method,
        headers: {
          'User-Agent': 'BATTECHNO-LMS-perf-audit/1.0',
          Accept: '*/*',
          ...headers,
        },
        agent,
        timeout: timeoutMs,
        servername: u.hostname,
      },
      (res) => {
        ttfb = performance.now() - started;
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          resolve({
            ok: true,
            url: urlStr,
            method,
            status: res.statusCode,
            statusText: res.statusMessage,
            ttfbMs: Math.round(ttfb),
            totalMs: Math.round(performance.now() - started),
            bytes: buf.length,
            headers: redactHeaders(res.headers),
            body: buf,
          });
        });
      }
    );
    req.on('timeout', () => {
      req.destroy(new Error('timeout'));
    });
    req.on('error', (err) => {
      resolve({
        ok: false,
        url: urlStr,
        method,
        error: err.message,
        code: err.code || null,
        totalMs: Math.round(performance.now() - started),
        ttfbMs: ttfb,
      });
    });
    req.end();
  });
}

function tlsHandshake(hostname) {
  return new Promise((resolve) => {
    const started = performance.now();
    const socket = tls.connect(
      {
        host: hostname,
        port: 443,
        servername: hostname,
        timeout: 15000,
      },
      () => {
        const ms = Math.round(performance.now() - started);
        const info = {
          handshakeMs: ms,
          protocol: socket.getProtocol(),
          authorized: socket.authorized,
          alpn: socket.alpnProtocol || null,
          cipher: socket.getCipher(),
          cert: (() => {
            const c = socket.getPeerCertificate();
            return {
              subject: c.subject,
              issuer: c.issuer,
              valid_from: c.valid_from,
              valid_to: c.valid_to,
              subjectaltname: c.subjectaltname,
            };
          })(),
        };
        socket.end();
        resolve(info);
      }
    );
    socket.on('error', (err) => {
      resolve({ error: err.message, code: err.code || null, handshakeMs: Math.round(performance.now() - started) });
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ error: 'timeout', handshakeMs: Math.round(performance.now() - started) });
    });
  });
}

function stats(samples) {
  const nums = samples.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!nums.length) return null;
  const sum = nums.reduce((a, b) => a + b, 0);
  const pct = (p) => nums[Math.min(nums.length - 1, Math.max(0, Math.ceil((p / 100) * nums.length) - 1))];
  return {
    n: nums.length,
    min: nums[0],
    p50: pct(50),
    avg: Math.round((sum / nums.length) * 10) / 10,
    p95: pct(95),
    max: nums[nums.length - 1],
  };
}

function extractAssets(html) {
  const assets = [];
  const re = /(href|src)=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    const url = m[2];
    if (url.startsWith('data:') || url.startsWith('mailto:')) continue;
    assets.push(url);
  }
  return [...new Set(assets)];
}

async function main() {
  const summary = {
    probedAt: new Date().toISOString(),
    origin: ORIGIN,
    expectedIp: EXPECTED_IP,
  };

  const dnsLookup = await dns.lookup(HOST, { all: true }).catch((e) => ({ error: e.message }));
  const addresses = Array.isArray(dnsLookup) ? dnsLookup.map((x) => x.address) : [];
  summary.dns = { addresses, matchesExpectedIp: addresses.includes(EXPECTED_IP) };

  let resolve4 = null;
  try {
    const t0 = performance.now();
    resolve4 = await dns.resolve4(HOST);
    summary.dns.lookupMs = Math.round(performance.now() - t0);
    summary.dns.resolve4 = resolve4;
  } catch (e) {
    summary.dns.resolveError = e.message;
  }

  summary.tls = await tlsHandshake(HOST);

  const keepAliveAgent = new https.Agent({ keepAlive: true, maxSockets: 8 });
  const noKeepAliveAgent = new https.Agent({ keepAlive: false });

  const healthSamples = [];
  const readySamples = [];
  for (let i = 0; i < 8; i += 1) {
    const h = await requestOnce(`${ORIGIN}/health`, { agent: keepAliveAgent });
    healthSamples.push({
      i,
      ts: new Date().toISOString(),
      status: h.status,
      ttfbMs: h.ttfbMs,
      totalMs: h.totalMs,
      bytes: h.bytes,
      error: h.error || null,
      encoding: h.headers && h.headers['content-encoding'],
      server: h.headers && h.headers.server,
      cfRay: h.headers && h.headers['cf-ray'],
      via: h.headers && h.headers.via,
      connection: h.headers && h.headers.connection,
    });
    const r = await requestOnce(`${ORIGIN}/health/ready`, { agent: keepAliveAgent });
    let readyBody = null;
    if (r.body) {
      try {
        readyBody = JSON.parse(r.body.toString('utf8'));
      } catch {
        readyBody = { parseError: true };
      }
    }
    readySamples.push({
      i,
      ts: new Date().toISOString(),
      status: r.status,
      ttfbMs: r.ttfbMs,
      totalMs: r.totalMs,
      bytes: r.bytes,
      error: r.error || null,
      body: readyBody,
    });
    if (i < 7) await sleep(1500);
  }

  const htmlRes = await requestOnce(`${ORIGIN}/`, {
    agent: keepAliveAgent,
    headers: { Accept: 'text/html' },
  });
  const html = htmlRes.body ? htmlRes.body.toString('utf8') : '';
  const assets = extractAssets(html);
  const htmlInfo = {
    status: htmlRes.status,
    ttfbMs: htmlRes.ttfbMs,
    totalMs: htmlRes.totalMs,
    bytes: htmlRes.bytes,
    encoding: htmlRes.headers && htmlRes.headers['content-encoding'],
    cacheControl: htmlRes.headers && htmlRes.headers['cache-control'],
    server: htmlRes.headers && htmlRes.headers.server,
    cfRay: htmlRes.headers && htmlRes.headers['cf-ray'],
    xPoweredBy: htmlRes.headers && htmlRes.headers['x-powered-by'],
    contentType: htmlRes.headers && htmlRes.headers['content-type'],
    assetUrls: assets,
  };

  const loginRes = await requestOnce(`${ORIGIN}/login`, { agent: keepAliveAgent, headers: { Accept: 'text/html' } });
  htmlInfo.loginStatus = loginRes.status;
  htmlInfo.loginMs = loginRes.totalMs;
  htmlInfo.loginBytes = loginRes.bytes;

  const absAssets = assets
    .map((a) => {
      if (a.startsWith('http')) return a;
      if (a.startsWith('//')) return `https:${a}`;
      if (a.startsWith('/')) return ORIGIN + a;
      return `${ORIGIN}/${a.replace(/^\.\//, '')}`;
    })
    .filter((a) => a.includes(HOST) || a.startsWith(ORIGIN) || a.includes('fonts.google') || a.includes('fonts.gstatic'));

  const assetResults = [];
  for (const url of absAssets.slice(0, 40)) {
    const r = await requestOnce(url, { agent: keepAliveAgent, method: 'GET' });
    assetResults.push({
      url,
      status: r.status,
      ttfbMs: r.ttfbMs,
      totalMs: r.totalMs,
      bytes: r.bytes,
      encoding: r.headers && r.headers['content-encoding'],
      cacheControl: r.headers && r.headers['cache-control'],
      contentType: r.headers && r.headers['content-type'],
      error: r.error || null,
    });
  }

  const extraPaths = [
    '/favicon.ico',
    '/assets/',
    '/api/auth/me',
    '/api/v1/universities',
    '/health/ready',
  ];
  const extra = [];
  for (const p of extraPaths) {
    const r = await requestOnce(`${ORIGIN}${p}`, { agent: keepAliveAgent });
    extra.push({
      path: p,
      status: r.status,
      ttfbMs: r.ttfbMs,
      totalMs: r.totalMs,
      bytes: r.bytes,
      cacheControl: r.headers && r.headers['cache-control'],
      encoding: r.headers && r.headers['content-encoding'],
      error: r.error || null,
    });
  }

  const ka1 = await requestOnce(`${ORIGIN}/health`, { agent: keepAliveAgent });
  const ka2 = await requestOnce(`${ORIGIN}/health`, { agent: keepAliveAgent });
  const nk1 = await requestOnce(`${ORIGIN}/health`, { agent: noKeepAliveAgent });
  const nk2 = await requestOnce(`${ORIGIN}/health`, { agent: noKeepAliveAgent });

  const www = await requestOnce('https://www.lms.battechno.com/health', { agent: keepAliveAgent }).catch((e) => ({
    error: e.message,
  }));

  const ipWho = await requestOnce(`http://ip-api.com/json/${EXPECTED_IP}?fields=status,country,regionName,city,isp,org,as,query,lat,lon`, {
    timeoutMs: 8000,
  });
  let geo = null;
  if (ipWho.body) {
    try {
      geo = JSON.parse(ipWho.body.toString('utf8'));
    } catch {
      geo = { parseError: true };
    }
  }

  const network = {
    dns: summary.dns,
    tls: summary.tls,
    html: htmlInfo,
    healthSamples,
    readySamples,
    healthStats: {
      ttfb: stats(healthSamples.map((s) => s.ttfbMs)),
      total: stats(healthSamples.map((s) => s.totalMs)),
      statuses: healthSamples.map((s) => s.status),
    },
    readyStats: {
      ttfb: stats(readySamples.map((s) => s.ttfbMs)),
      total: stats(readySamples.map((s) => s.totalMs)),
      statuses: readySamples.map((s) => s.status),
    },
    keepAlive: {
      reused: [ka1.totalMs, ka2.totalMs],
      newConn: [nk1.totalMs, nk2.totalMs],
    },
    wwwHealth: { status: www.status, totalMs: www.totalMs, error: www.error || null },
    extra,
    geo,
  };

  fs.writeFileSync(path.join(OUT, 'browser-network.json'), JSON.stringify({ html: htmlInfo, assets: assetResults, extra }, null, 2));
  fs.writeFileSync(
    path.join(OUT, 'endpoint-latencies.json'),
    JSON.stringify(
      {
        health: healthSamples,
        ready: readySamples,
        extra,
        keepAlive: network.keepAlive,
      },
      null,
      2
    )
  );

  summary.health = network.healthStats;
  summary.ready = network.readyStats;
  summary.cdn = {
    cfRayOnHtml: Boolean(htmlInfo.cfRay),
    server: htmlInfo.server,
    htmlEncoding: htmlInfo.encoding,
  };
  summary.largestAsset = assetResults.reduce(
    (best, a) => (!best || (a.bytes || 0) > (best.bytes || 0) ? a : best),
    null
  );
  summary.slowestAsset = assetResults.reduce(
    (best, a) => (!best || (a.totalMs || 0) > (best.totalMs || 0) ? a : best),
    null
  );

  fs.writeFileSync(path.join(OUT, '_probe-raw.json'), JSON.stringify({ summary, network, assetResults }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

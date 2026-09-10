'use strict';
const https = require('https');
const { performance } = require('perf_hooks');

function get(path) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const req = https.get(
      `https://lms.battechno.com${path}`,
      { headers: { 'User-Agent': 'BATTECHNO-LMS-p0.1/1.0' } },
      (res) => {
        res.resume();
        res.on('end', () =>
          resolve({ path, status: res.statusCode, ms: Math.round(performance.now() - t0) })
        );
      }
    );
    req.on('error', (e) => resolve({ path, error: e.message, ms: Math.round(performance.now() - t0) }));
    req.setTimeout(20000, () => {
      req.destroy();
      resolve({ path, error: 'timeout', ms: Math.round(performance.now() - t0) });
    });
  });
}

function stats(samples) {
  const nums = samples.map((s) => s.ms).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  const sum = nums.reduce((a, b) => a + b, 0);
  const pct = (p) => nums[Math.min(nums.length - 1, Math.max(0, Math.ceil((p / 100) * nums.length) - 1))];
  return {
    n: nums.length,
    min: nums[0],
    p50: pct(50),
    avg: Math.round((sum / nums.length) * 10) / 10,
    max: nums[nums.length - 1],
    statuses: samples.map((s) => s.status),
  };
}

(async () => {
  const health = [];
  const ready = [];
  await get('/health');
  await get('/health/ready');
  for (let i = 0; i < 10; i += 1) {
    health.push(await get('/health'));
    ready.push(await get('/health/ready'));
  }
  console.log(JSON.stringify({ health: stats(health), ready: stats(ready), healthSamples: health, readySamples: ready }, null, 2));
})();

'use strict';

const https = require('https');
const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

function get(url, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const t0 = performance.now();
    https
      .get(
        url,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Encoding': 'gzip, deflate, br',
            ...extraHeaders,
          },
        },
        (res) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            resolve({
              url,
              status: res.statusCode,
              ms: Math.round(performance.now() - t0),
              bytesOnWire: Buffer.concat(chunks).length,
              encoding: res.headers['content-encoding'] || null,
              cache: res.headers['cache-control'] || null,
              type: res.headers['content-type'] || null,
              vary: res.headers.vary || null,
            });
          });
        }
      )
      .on('error', reject);
  });
}

function getText(url, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120.0.0.0', ...extraHeaders } }, (res) => {
        let d = '';
        res.on('data', (c) => {
          d += c;
        });
        res.on('end', () => resolve(d));
      })
      .on('error', reject);
  });
}

(async () => {
  const urls = [
    'https://lms.battechno.com/assets/index-CUxTz4B_.js',
    'https://lms.battechno.com/assets/index-C5tZjQvg.css',
    'https://lms.battechno.com/assets/react-vendor-BWxfWDgY.js',
    'https://lms.battechno.com/assets/framer-motion-CQ0wxfVc.js',
    'https://lms.battechno.com/',
    'https://lms.battechno.com/health/ready',
    'https://lms.battechno.com/assets/index-CUxTz4B_.js.map',
  ];
  const compressed = [];
  for (const u of urls) compressed.push(await get(u));

  const css = await getText(
    'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Tajawal:wght@400;500;600;700&display=swap'
  );
  const fonts = [...new Set([...css.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1].replace(/['"]/g, '')))];
  const fontResults = [];
  let fontTotal = 0;
  for (const f of fonts) {
    const r = await get(f);
    fontTotal += r.bytesOnWire;
    fontResults.push(r);
  }

  let geo = null;
  try {
    const raw = await getText('https://ipapi.co/187.55.228.232/json/');
    geo = JSON.parse(raw);
    delete geo.latitude;
    delete geo.longitude;
    delete geo.postal;
  } catch (e) {
    geo = { error: e.message };
  }

  const out = { compressed, fonts: fontResults, fontCount: fonts.length, fontTotalBytes: fontTotal, geo };
  fs.writeFileSync(path.join(__dirname, 'gzip-fonts.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

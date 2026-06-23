/**
 * Removes edge-connected white/near-white backgrounds from partner logos.
 * Preserves interior white (e.g. text) that is not connected to the image border.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const partnersDir = path.join(__dirname, '../public/partners');

/** @type {ReadonlyArray<[string, string]>} */
const FILES = [
  ['youth-ministry.png', 'ministry-youth-transparent.png'],
  ['digital-economy.png', 'ministry-digital-economy-transparent.png'],
  ['tafila-tech.png', 'tafila-university-transparent.png'],
  ['mutah.png', 'mutah-university-transparent.png'],
  ['zaytoonah.png', 'al-zaytoonah-university-transparent.png'],
  ['yarmouk.png', 'yarmouk-university-transparent.png'],
];

const WHITE_THRESHOLD = 238;
const CHANNEL_TOLERANCE = 18;

function isBackgroundPixel(r, g, b) {
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);
  return min >= WHITE_THRESHOLD && max - min <= CHANNEL_TOLERANCE;
}

function removeEdgeWhite(data, width, height) {
  const total = width * height;
  const visited = new Uint8Array(total);
  const queue = [];

  const tryPush = (x, y) => {
    const idx = y * width + x;
    if (visited[idx]) return;
    const offset = idx * 4;
    if (!isBackgroundPixel(data[offset], data[offset + 1], data[offset + 2])) return;
    visited[idx] = 1;
    queue.push(idx);
  };

  for (let x = 0; x < width; x += 1) {
    tryPush(x, 0);
    tryPush(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    tryPush(0, y);
    tryPush(width - 1, y);
  }

  while (queue.length) {
    const idx = queue.pop();
    const offset = idx * 4;
    data[offset + 3] = 0;

    const x = idx % width;
    const y = (idx - x) / width;

    if (x > 0) tryPush(x - 1, y);
    if (x < width - 1) tryPush(x + 1, y);
    if (y > 0) tryPush(x, y - 1);
    if (y < height - 1) tryPush(x, y + 1);
  }
}

async function processLogo(inputName, outputName) {
  const inputPath = path.join(partnersDir, inputName);
  const outputPath = path.join(partnersDir, outputName);

  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = Buffer.from(data);
  removeEdgeWhite(pixels, info.width, info.height);

  await sharp(pixels, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .trim({ threshold: 10 })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outputPath);

  console.log(`✓ ${inputName} → ${outputName}`);
}

for (const [input, output] of FILES) {
  await processLogo(input, output);
}

console.log('Done — transparent partner logos saved.');

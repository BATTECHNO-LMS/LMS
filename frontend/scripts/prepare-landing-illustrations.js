/**
 * Copies Storyset/unDraw SVGs into assets/landing/illustrations/
 * with BATTECHNO LMS theme colors applied.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const srcDir = path.join(root, 'src/assets/images');
const outDir = path.join(root, 'src/assets/landing/illustrations');

/** @type {Record<string, string>} */
const COLOR_MAP = {
  '#263238': '#132D4A',
  '#37474F': '#132D4A',
  '#455A64': '#3A5F8A',
  '#757575': '#5C6675',
  '#878787': '#5C6675',
  '#919191': '#5C6675',
  '#92E3A9': '#F3EAD4',
  '#E5C536': '#C9A227',
  '#FF725E': '#C9A227',
  '#FFBDA7': '#F3EAD4',
  '#FFBE9D': '#F3EAD4',
  '#EB996E': '#A8861C',
  '#F0997A': '#E8D5A8',
  '#C8856A': '#A8861C',
  '#AF6152': '#A8861C',
  '#F28F8F': '#F3EAD4',
  '#FFA8A7': '#F3EAD4',
};

/** @type {ReadonlyArray<[string, string]>} */
const FILES = [
  ['Learning-bro.svg', 'hero-student-learning.svg'],
  ['Webinar-bro.svg', 'hero-instructor-sessions.svg'],
  ['Certification-pana.svg', 'hero-certificate.svg'],
  ['Blog post-bro.svg', 'hero-academic-reports.svg'],
  ['Certification-pana.svg', 'trust-verification.svg'],
  ['Webinar-bro.svg', 'portals-illustration.svg'],
  ['Blog post-bro.svg', 'journey-flow.svg'],
  ['Online learning-amico.svg', 'features-dashboard.svg'],
  ['Learning-bro.svg', 'cta-academic-illustration.svg'],
];

function recolorSvg(content) {
  let result = content;
  for (const [from, to] of Object.entries(COLOR_MAP)) {
    const re = new RegExp(from.replace('#', '#'), 'gi');
    result = result.replace(re, to);
  }
  return result;
}

fs.mkdirSync(outDir, { recursive: true });

for (const [srcName, outName] of FILES) {
  const raw = fs.readFileSync(path.join(srcDir, srcName), 'utf8');
  fs.writeFileSync(path.join(outDir, outName), recolorSvg(raw), 'utf8');
  console.log(`wrote ${outName}`);
}

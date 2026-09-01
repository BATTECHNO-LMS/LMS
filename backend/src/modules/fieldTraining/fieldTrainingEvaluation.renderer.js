'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const { randomUUID } = require('crypto');
const { pathToFileURL } = require('url');

const CONVERSION_TIMEOUT_MS = Number(process.env.FT_EVAL_PDF_TIMEOUT_MS) || 90_000;
const DEFAULT_CONCURRENCY = Math.max(
  1,
  Math.min(8, Number(process.env.FT_EVAL_PDF_CONCURRENCY) || 3)
);

const WINDOWS_CANDIDATES = [
  'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
  'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
];

const LINUX_CANDIDATES = [
  '/usr/bin/soffice',
  '/usr/local/bin/soffice',
  '/usr/lib/libreoffice/program/soffice',
  '/usr/lib64/libreoffice/program/soffice',
];

let cachedExecutable = undefined;
let cachedVersion = undefined;

function fileExists(candidate) {
  if (!candidate) return false;
  try {
    return fs.existsSync(candidate) && fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
}

function envCandidates() {
  return [process.env.LIBREOFFICE_PATH, process.env.SOFFICE_PATH].filter(Boolean);
}

function resolveFromPathLookup() {
  const lookup = process.platform === 'win32' ? 'where' : 'which';
  const target = process.platform === 'win32' ? 'soffice.exe' : 'soffice';
  try {
    const output = execFileSync(lookup, [target], {
      encoding: 'utf8',
      timeout: 5000,
      windowsHide: true,
    });
    const hit = String(output || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line && fileExists(line));
    return hit || null;
  } catch {
    return null;
  }
}

function discoverLibreOfficeExecutable({ refresh = false } = {}) {
  if (!refresh && cachedExecutable !== undefined) return cachedExecutable;

  const seen = new Set();
  const candidates = [
    ...envCandidates(),
    ...(process.platform === 'win32' ? WINDOWS_CANDIDATES : LINUX_CANDIDATES),
  ];

  for (const candidate of candidates) {
    const normalized = path.normalize(candidate);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    if (fileExists(normalized)) {
      cachedExecutable = normalized;
      return cachedExecutable;
    }
  }

  cachedExecutable = resolveFromPathLookup();
  return cachedExecutable;
}

function findSoffice(options) {
  return discoverLibreOfficeExecutable(options);
}

function invalidateRendererCache() {
  cachedExecutable = undefined;
  cachedVersion = undefined;
}

function readVersionIni(soffice) {
  try {
    const iniPath = path.join(path.dirname(soffice), 'version.ini');
    if (!fs.existsSync(iniPath)) return null;
    const ini = fs.readFileSync(iniPath, 'utf8');
    const updateId = (ini.match(/^UpdateID=(.+)$/m) || [])[1] || '';
    const fromUpdateId = updateId.match(/LibreOffice_(\d+(?:\.\d+)*)/i);
    if (fromUpdateId) return `LibreOffice ${fromUpdateId[1]}`;
    const vendor = (ini.match(/^Vendor=(.+)$/m) || [])[1] || 'LibreOffice';
    return `${vendor} (installed)`;
  } catch {
    return null;
  }
}

function readLibreOfficeVersion(soffice) {
  if (!soffice) return null;
  try {
    const output = execFileSync(soffice, ['--headless', '--version'], {
      encoding: 'utf8',
      timeout: 15_000,
      windowsHide: true,
    });
    const line = String(output || '')
      .split(/\r?\n/)
      .map((row) => row.trim())
      .find(Boolean);
    if (line) return line;
  } catch (err) {
    const merged = `${err?.stdout || ''}\n${err?.stderr || ''}`.trim();
    const line = merged
      .split(/\r?\n/)
      .map((row) => row.trim())
      .find(Boolean);
    if (line) return line;
  }
  return readVersionIni(soffice);
}

function getOfficialDocumentRendererStatus({ includeExecutable = false, refresh = false } = {}) {
  const executable = discoverLibreOfficeExecutable({ refresh });
  const available = Boolean(executable);

  if (refresh || !cachedVersion) {
    cachedVersion = available ? readLibreOfficeVersion(executable) : null;
  }

  const status = {
    available,
    engine: 'libreoffice',
    version: cachedVersion,
    concurrencyLimit: DEFAULT_CONCURRENCY,
  };

  if (includeExecutable) {
    status.executable = executable;
  } else if (available) {
    status.executableBasename = path.basename(executable);
  }

  return status;
}

function runProcess(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, windowsHide: true });
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('DOCX conversion timed out'));
    }, CONVERSION_TIMEOUT_MS);
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `Converter exited ${code}`));
    });
  });
}

class ConversionSemaphore {
  constructor(limit) {
    this.limit = limit;
    this.active = 0;
    this.queue = [];
  }

  run(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this._pump();
    });
  }

  _pump() {
    while (this.active < this.limit && this.queue.length) {
      const job = this.queue.shift();
      this.active += 1;
      Promise.resolve()
        .then(() => job.task())
        .then(job.resolve, job.reject)
        .finally(() => {
          this.active -= 1;
          this._pump();
        });
    }
  }
}

const conversionQueue = new ConversionSemaphore(DEFAULT_CONCURRENCY);

async function convertDocxBufferWithLibreOffice(docxBuffer, soffice = findSoffice()) {
  if (!soffice) throw new Error('LibreOffice executable not found');

  return conversionQueue.run(async () => {
    const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), `ft-eval-${randomUUID()}-`));
    const inputName = `${randomUUID()}.docx`;
    const input = path.join(dir, inputName);
    const profileDir = path.join(dir, 'libreoffice-profile');
    try {
      await fs.promises.mkdir(profileDir, { recursive: true });
      await fs.promises.writeFile(input, docxBuffer);
      await runProcess(
        soffice,
        [
          `-env:UserInstallation=${pathToFileURL(profileDir).href}`,
          '--headless',
          '--nologo',
          '--nofirststartwizard',
          '--convert-to',
          'pdf',
          '--outdir',
          dir,
          input,
        ],
        dir
      );
      const pdfName = fs.readdirSync(dir).find((name) => name.toLowerCase().endsWith('.pdf'));
      if (!pdfName) throw new Error('LibreOffice did not produce a PDF');
      return fs.promises.readFile(path.join(dir, pdfName));
    } finally {
      await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => null);
    }
  });
}

module.exports = {
  CONVERSION_TIMEOUT_MS,
  DEFAULT_CONCURRENCY,
  discoverLibreOfficeExecutable,
  findSoffice,
  invalidateRendererCache,
  readLibreOfficeVersion,
  getOfficialDocumentRendererStatus,
  convertDocxBufferWithLibreOffice,
  ConversionSemaphore,
};

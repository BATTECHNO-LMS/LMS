'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { randomUUID } = require('crypto');
const mammoth = require('mammoth');
const { renderHtmlToPdf } = require('../analytics/pdfRenderer');

function findSoffice() {
  const candidates = [
    process.env.LIBREOFFICE_PATH,
    process.env.SOFFICE_PATH,
    'soffice',
    'soffice.exe',
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    '/usr/bin/soffice',
    '/usr/bin/libreoffice',
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate === 'soffice' || candidate === 'soffice.exe') continue;
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      /* next */
    }
  }
  return process.env.LIBREOFFICE_PATH || process.env.SOFFICE_PATH || null;
}

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, windowsHide: true });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `Converter exited ${code}`));
    });
  });
}

async function convertWithLibreOffice(docxBuffer, soffice) {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ft-eval-'));
  const input = path.join(dir, `${randomUUID()}.docx`);
  try {
    await fs.promises.writeFile(input, docxBuffer);
    await run(soffice, ['--headless', '--convert-to', 'pdf', '--outdir', dir, input], dir);
    const pdfName = fs.readdirSync(dir).find((name) => name.toLowerCase().endsWith('.pdf'));
    if (!pdfName) throw new Error('LibreOffice did not produce a PDF');
    return fs.promises.readFile(path.join(dir, pdfName));
  } finally {
    await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => null);
  }
}

function wrapHtml(body) {
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
    body{font-family:"Noto Naskh Arabic","Segoe UI",Tahoma,sans-serif;color:#111;line-height:1.5}
    img{max-width:100%}
    table{border-collapse:collapse;width:100%}
    td,th{border:1px solid #ccc;padding:4px}
  </style></head><body>${body}</body></html>`;
}

async function convertFilledDocxToPdf(docxBuffer) {
  const soffice = findSoffice();
  if (soffice) {
    try {
      return await convertWithLibreOffice(docxBuffer, soffice);
    } catch {
      /* fall through to mammoth + Chromium */
    }
  }
  const { value } = await mammoth.convertToHtml({ buffer: docxBuffer });
  return renderHtmlToPdf(wrapHtml(value), { lang: 'ar' });
}

module.exports = { convertFilledDocxToPdf, findSoffice };

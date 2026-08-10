'use strict';

const fs = require('fs');
const path = require('path');
const { renderHtmlToPdf } = require('../analytics/pdfRenderer');
const { buildTrainingReportHtml } = require('./trainingReport.template');
const { prisma } = require('../../config/db');

function loadBattechnoLogoDataUri() {
  const candidates = [
    path.join(__dirname, '../../../../frontend/src/assets/images/battechno-lms-logo-transparent.png'),
    path.join(__dirname, '../../../assets/battechno-lms-logo-transparent.png'),
    path.join(process.cwd(), '../frontend/src/assets/images/battechno-lms-logo-transparent.png'),
  ];
  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        const buf = fs.readFileSync(file);
        return `data:image/png;base64,${buf.toString('base64')}`;
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

function resolveLocalUploadPath(logoUrl) {
  if (!logoUrl) return null;
  if (logoUrl.startsWith('data:')) return null;
  if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) return null;
  const cleaned = logoUrl.replace(/^\//, '');
  const candidates = [
    path.join(process.cwd(), cleaned),
    path.join(process.cwd(), 'uploads', path.basename(cleaned)),
    path.join(process.cwd(), 'public', cleaned),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) return file;
  }
  return null;
}

async function loadInstitutionLogoDataUri(logoUrl) {
  if (!logoUrl) return null;
  if (logoUrl.startsWith('data:')) return logoUrl;
  const local = resolveLocalUploadPath(logoUrl);
  if (local) {
    const buf = fs.readFileSync(local);
    const ext = path.extname(local).toLowerCase();
    const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png';
    return `data:${mime};base64,${buf.toString('base64')}`;
  }
  if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
    try {
      const res = await fetch(logoUrl);
      if (!res.ok) return null;
      const arr = Buffer.from(await res.arrayBuffer());
      const contentType = res.headers.get('content-type') || 'image/png';
      return `data:${contentType};base64,${arr.toString('base64')}`;
    } catch {
      return null;
    }
  }
  return null;
}

async function loadBrandAssets(report) {
  const snap = report.snapshot_json || {};
  let institutionLogoUrl = snap.meta?.institutionLogoUrl || null;
  let organizationCode = snap.meta?.institutionCode || null;
  let organizationName = snap.meta?.institutionName || null;

  if (!organizationCode || institutionLogoUrl === undefined || !organizationName) {
    const org = await prisma.organizations.findUnique({
      where: { id: report.organization_id },
      select: { logo_url: true, name: true, code: true },
    });
    organizationCode = organizationCode || org?.code || null;
    organizationName = organizationName || org?.name || null;
    if (!snap.meta) snap.meta = {};
    if (!snap.meta.institutionName) snap.meta.institutionName = organizationName;
    if (!snap.meta.institutionCode) snap.meta.institutionCode = organizationCode;
    if (institutionLogoUrl == null && org?.code !== 'BATTECHNO') {
      institutionLogoUrl = org?.logo_url || null;
    }
  }

  const singleBrand =
    Boolean(snap.meta?.singleBrand) || organizationCode === 'BATTECHNO';

  return {
    battechnoLogoDataUri: loadBattechnoLogoDataUri(),
    institutionLogoDataUri: singleBrand ? null : await loadInstitutionLogoDataUri(institutionLogoUrl),
    singleBrand,
  };
}

async function renderTrainingReportPdf(report) {
  const assets = await loadBrandAssets(report);
  const html = buildTrainingReportHtml(report, assets, { printable: false });
  return renderHtmlToPdf(html, { lang: 'ar' });
}

module.exports = {
  loadBattechnoLogoDataUri,
  loadInstitutionLogoDataUri,
  loadBrandAssets,
  renderTrainingReportPdf,
};

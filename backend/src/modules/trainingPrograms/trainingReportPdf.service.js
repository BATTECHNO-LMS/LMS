'use strict';

const fs = require('fs');
const path = require('path');
const { renderHtmlToPdf } = require('../analytics/pdfRenderer');
const { buildTrainingReportHtml } = require('./trainingReport.template');
const { prisma } = require('../../config/db');
const { env } = require('../../config/env');
const { assertSafePublicUrl } = require('../fieldTraining/fieldTraining.urlFetch');

const MAX_LOGO_BYTES = 1_500_000;

function toLogoDataUri(buf, mime) {
  if (!buf || buf.length > MAX_LOGO_BYTES) return null;
  const safeMime = String(mime || 'image/png').split(';')[0].trim().toLowerCase();
  // SVG intentionally excluded — active content must not be embedded into PDF HTML.
  if (!/^image\/(png|jpe?g|webp|gif)$/.test(safeMime)) return null;
  return `data:${safeMime};base64,${Buffer.from(buf).toString('base64')}`;
}

function loadBattechnoLogoDataUri() {
  const candidates = [
    path.join(__dirname, '../../../../frontend/src/assets/images/eprojecto-logo.png'),
    path.join(__dirname, '../../../assets/eprojecto-logo.png'),
    path.join(process.cwd(), '../frontend/src/assets/images/eprojecto-logo.png'),
    path.join(process.cwd(), 'assets/eprojecto-logo.png'),
  ];
  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        const buf = fs.readFileSync(file);
        const dataUri = toLogoDataUri(buf, 'image/png');
        if (dataUri) return dataUri;
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

/**
 * Resolve a logo path only under the configured upload root (no arbitrary cwd reads).
 * @param {string} logoUrl
 * @returns {string | null}
 */
function resolveLocalUploadPath(logoUrl) {
  if (!logoUrl) return null;
  if (logoUrl.startsWith('data:')) return null;
  if (/^https?:\/\//i.test(logoUrl)) return null;

  const uploadRoot = path.resolve(env.UPLOAD_DIR || 'uploads');
  let relative = String(logoUrl).replace(/\\/g, '/').replace(/^\//, '');
  // Common stored forms: "uploads/org/logo.png" or "org/logo.png"
  if (relative.startsWith('uploads/')) relative = relative.slice('uploads/'.length);

  const resolved = path.resolve(uploadRoot, relative);
  const rootWithSep = uploadRoot.endsWith(path.sep) ? uploadRoot : `${uploadRoot}${path.sep}`;
  if (resolved !== uploadRoot && !resolved.startsWith(rootWithSep)) {
    return null;
  }
  try {
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) return resolved;
  } catch {
    return null;
  }
  return null;
}

async function fetchPublicLogo(logoUrl) {
  await assertSafePublicUrl(logoUrl);
  const res = await fetch(logoUrl, {
    method: 'GET',
    redirect: 'manual',
    signal: AbortSignal.timeout(5_000),
    headers: { Accept: 'image/*,*/*;q=0.1' },
  });
  if ([301, 302, 303, 307, 308].includes(res.status)) {
    // Do not follow redirects without re-validating — treat as unavailable.
    return null;
  }
  if (!res.ok) return null;
  const contentType = (res.headers.get('content-type') || 'image/png').split(';')[0].trim();
  if (!/^image\/(png|jpe?g|webp|gif)$/i.test(contentType)) return null;
  const arr = Buffer.from(await res.arrayBuffer());
  return toLogoDataUri(arr, contentType);
}

async function loadInstitutionLogoDataUri(logoUrl) {
  if (!logoUrl) return null;
  if (logoUrl.startsWith('data:')) {
    // Only allow raster data-URIs (no SVG).
    if (!/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(logoUrl)) return null;
    return logoUrl.length > MAX_LOGO_BYTES * 2 ? null : logoUrl;
  }
  const local = resolveLocalUploadPath(logoUrl);
  if (local) {
    const buf = fs.readFileSync(local);
    const ext = path.extname(local).toLowerCase();
    const mime =
      ext === '.jpg' || ext === '.jpeg'
        ? 'image/jpeg'
        : ext === '.webp'
          ? 'image/webp'
          : ext === '.gif'
            ? 'image/gif'
            : 'image/png';
    return toLogoDataUri(buf, mime);
  }
  if (/^https?:\/\//i.test(logoUrl)) {
    try {
      return await fetchPublicLogo(logoUrl);
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

  const singleBrand = Boolean(snap.meta?.singleBrand) || organizationCode === 'BATTECHNO';

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
  resolveLocalUploadPath,
  renderTrainingReportPdf,
};

const fs = require('fs');
const puppeteer = require('puppeteer');
const { ApiError } = require('../../utils/apiError');

const CHROME_CANDIDATES = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  process.env.CHROME_PATH,
  process.env.GOOGLE_CHROME_BIN,
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chrome',
].filter(Boolean);

function resolveChromeExecutable() {
  for (const candidate of CHROME_CANDIDATES) {
    try {
      if (candidate && fs.existsSync(candidate)) return candidate;
    } catch {
      /* try next */
    }
  }
  return undefined;
}

/**
 * Render UTF-8 HTML (Arabic/RTL) to a PDF buffer via headless Chromium.
 * Does not wait on external fonts/CDN — production Alpine has no networkidle Google Fonts.
 * @param {string} html
 * @param {{ lang?: string }} [options]
 * @returns {Promise<Buffer>}
 */
async function renderHtmlToPdf(html, options = {}) {
  const lang = options.lang === 'en' ? 'en' : 'ar';
  const isRtl = lang !== 'en';
  const executablePath = resolveChromeExecutable();

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--font-render-hinting=medium',
      ],
    });
  } catch (err) {
    throw new ApiError(
      503,
      'تعذر إنشاء ملف PDF على الخادم.',
      { reason: err?.message || 'puppeteer_launch_failed' },
      'PDF_RENDER_UNAVAILABLE'
    );
  }

  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return req.abort();
      }
      return req.continue();
    });

    await page.setContent(String(html || ''), { waitUntil: 'domcontentloaded', timeout: 30_000 });

    const footerNote =
      lang === 'en'
        ? 'Internal administrative use only'
        : 'هذا التقرير للاستخدام الإداري الداخلي';

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '10mm', right: '12mm', bottom: '18mm', left: '12mm' },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `
        <div style="width:100%;font-size:8px;color:#5c6675;padding:0 12mm;font-family:Tahoma,'Noto Naskh Arabic',Arial,sans-serif;direction:${isRtl ? 'rtl' : 'ltr'};">
          <div style="display:flex;justify-content:space-between;align-items:center;width:100%;">
            <span>BATTECHNO LMS · ${new Date().toISOString().slice(0, 10)}</span>
            <span>${footerNote}</span>
            <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
          </div>
        </div>
      `,
    });

    return Buffer.from(pdf);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      500,
      'تعذر إنشاء ملف PDF.',
      { reason: err?.message || 'pdf_render_failed' },
      'PDF_RENDER_FAILED'
    );
  } finally {
    if (browser) {
      await browser.close().catch(() => null);
    }
  }
}

module.exports = { renderHtmlToPdf, resolveChromeExecutable };

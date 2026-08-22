const fs = require('fs');
const puppeteer = require('puppeteer');
const { ApiError } = require('../../utils/apiError');

const LAUNCH_TIMEOUT_MS = 25_000;
const RENDER_TIMEOUT_MS = 45_000;
const CLOSE_TIMEOUT_MS = 3_000;

const CHROME_CANDIDATES = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  process.env.CHROME_PATH,
  process.env.GOOGLE_CHROME_BIN,
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

function sanitizePdfFooterText(value) {
  return String(value || '')
    .replace(/[<>&]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 180);
}

function pdfFailed(message, reason, code = 'PDF_RENDER_FAILED', status = 500) {
  return new ApiError(status, message, { reason }, code);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * One Chromium at a time. Concurrent launches hang on Windows and never finish the HTTP request.
 */
let pdfQueue = Promise.resolve();

/**
 * Render UTF-8 HTML (Arabic/RTL) to a PDF buffer via headless Chromium.
 * HTML must be self-contained (local fonts / data URIs). External network is not required.
 * @param {string} html
 * @param {{ lang?: string, footerNote?: string, footerLeft?: string }} [options]
 * @returns {Promise<Buffer>}
 */
function renderHtmlToPdf(html, options = {}) {
  const run = () => renderHtmlToPdfOnce(html, options);
  const next = pdfQueue.then(run, run);
  pdfQueue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

async function renderHtmlToPdfOnce(html, options = {}) {
  const lang = options.lang === 'en' ? 'en' : 'ar';
  const isRtl = lang !== 'en';
  const executablePath = resolveChromeExecutable();

  let browser;
  let watchdog;
  let timedOut = false;
  try {
    watchdog = setTimeout(() => {
      timedOut = true;
      browser?.process()?.kill('SIGKILL');
      browser?.close().catch(() => null);
    }, RENDER_TIMEOUT_MS);

    browser = await puppeteer.launch({
      headless: true,
      timeout: LAUNCH_TIMEOUT_MS,
      protocolTimeout: RENDER_TIMEOUT_MS,
      ...(executablePath ? { executablePath } : {}),
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--font-render-hinting=medium',
        '--hide-scrollbars',
      ],
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(RENDER_TIMEOUT_MS);
    await page.emulateMediaType('print');
    await page.setContent(String(html || ''), { waitUntil: 'domcontentloaded', timeout: 20_000 });

    const footerNote = sanitizePdfFooterText(
      options.footerNote ||
        (lang === 'en' ? 'Internal administrative use only' : 'هذا التقرير للاستخدام الإداري الداخلي')
    );
    const footerLeft = sanitizePdfFooterText(
      options.footerLeft ||
        `BATTECHNO LMS · ${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Amman' }).format(new Date())}`
    );

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      timeout: 30_000,
      margin: { top: '14mm', right: '12mm', bottom: '18mm', left: '12mm' },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `
        <div style="width:100%;font-size:8px;color:#5c6675;padding:0 12mm;font-family:Tahoma,'Noto Naskh Arabic',Arial,sans-serif;direction:${isRtl ? 'rtl' : 'ltr'};">
          <div style="display:flex;justify-content:space-between;align-items:center;width:100%;">
            <span>${footerLeft}</span>
            <span>${footerNote}</span>
            <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
          </div>
        </div>
      `,
    });

    if (timedOut) {
      throw pdfFailed('تعذر إنشاء ملف PDF.', 'pdf_watchdog');
    }
    return Buffer.from(pdf);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (timedOut) throw pdfFailed('تعذر إنشاء ملف PDF.', 'pdf_watchdog');
    const reason = err?.message || 'pdf_render_failed';
    if (/launch|browser process/i.test(reason)) {
      throw pdfFailed('تعذر إنشاء ملف PDF على الخادم.', reason, 'PDF_RENDER_UNAVAILABLE', 503);
    }
    throw pdfFailed('تعذر إنشاء ملف PDF.', reason);
  } finally {
    if (watchdog) clearTimeout(watchdog);
    if (browser) {
      await Promise.race([browser.close().catch(() => null), delay(CLOSE_TIMEOUT_MS)]);
    }
  }
}

module.exports = { renderHtmlToPdf, resolveChromeExecutable };

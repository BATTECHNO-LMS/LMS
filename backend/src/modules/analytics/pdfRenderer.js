const puppeteer = require('puppeteer');

/**
 * Render UTF-8 HTML (Arabic/RTL) to a PDF buffer via headless Chromium.
 * @param {string} html
 * @param {{ lang?: string }} [options]
 * @returns {Promise<Buffer>}
 */
async function renderHtmlToPdf(html, options = {}) {
  const lang = options.lang === 'en' ? 'en' : 'ar';
  const isRtl = lang !== 'en';

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=medium'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 90_000 });

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
        <div style="width:100%;font-size:8px;color:#5c6675;padding:0 12mm;font-family:Tajawal,'IBM Plex Sans Arabic',sans-serif;direction:${isRtl ? 'rtl' : 'ltr'};">
          <div style="display:flex;justify-content:space-between;align-items:center;width:100%;">
            <span>BATTECHNO LMS · ${new Date().toISOString().slice(0, 10)}</span>
            <span>${footerNote}</span>
            <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
          </div>
        </div>
      `,
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

module.exports = { renderHtmlToPdf };

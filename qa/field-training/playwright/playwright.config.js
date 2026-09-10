// @ts-check
const { defineConfig } = require('@playwright/test');
const path = require('path');

const artifacts = path.join(__dirname, '../../../qa-artifacts/field-training');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['json', { outputFile: path.join(artifacts, 'playwright-report.json') }],
  ],
  use: {
    baseURL: process.env.QA_BASE_URL || 'https://lms.battechno.com',
    headless: process.env.QA_HEADED === '1' ? false : true,
    viewport: { width: 1440, height: 900 },
    locale: 'ar',
    ignoreHTTPSErrors: true,
    video: 'on',
    screenshot: 'on',
    trace: 'on',
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
  },
  outputDir: path.join(artifacts, 'playwright-raw'),
});

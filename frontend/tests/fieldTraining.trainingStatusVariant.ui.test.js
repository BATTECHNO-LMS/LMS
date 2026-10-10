/**
 * Regression: Admin Field Training eligibility cards must render training
 * status through the shared helper. A missing import compiled cleanly and
 * threw `ReferenceError: trainingStatusVariant is not defined` in production.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { TRAINING_STATUSES } from '../src/features/fieldTraining/fieldTrainingConstants.js';
import { trainingStatusVariant } from '../src/features/fieldTraining/fieldTrainingUi.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const cardRel = '../src/pages/admin/fieldTraining/components/manage/EligibilityStudentCard.jsx';

const EXPECTED_VARIANTS = {
  none: 'muted',
  pre_assessment_pending: 'warning',
  pre_assessment_completed: 'muted',
  ready_for_training: 'muted',
  in_training: 'info',
  task_pending: 'muted',
  task_submitted: 'info',
  post_assessment_pending: 'warning',
  post_assessment_completed: 'muted',
  eligible_for_completion: 'success',
  completed: 'success',
  failed: 'danger',
  expelled: 'danger',
};

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8');
}

function loadArabic() {
  return JSON.parse(readSrc('../src/i18n/locales/ar/fieldTraining.json'));
}

function lookup(dict, key) {
  let cur = dict;
  for (const part of String(key).split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[part];
  }
  return typeof cur === 'string' ? cur : undefined;
}

function createTranslator(dict) {
  return function t(key, fallback) {
    const value = lookup(dict, key);
    if (typeof value === 'string') {
      if (fallback && typeof fallback === 'object') {
        return value.replace(/\{\{(\w+)\}\}/g, (_, name) => String(fallback[name] ?? ''));
      }
      return value;
    }
    if (typeof fallback === 'string') return fallback;
    return key;
  };
}

function participant(trainingStatus) {
  return {
    application_id: 'app-status-regression',
    student_name: 'طالب تجريبي',
    student_university: 'جامعة تجريبية',
    eligibility_status: 'pending',
    training_status: trainingStatus,
    qualification: { passingScore: 80, finalScore: 70 },
  };
}

describe('field training status badge variant', () => {
  it('maps every supported training status and keeps unknown values neutral', () => {
    assert.deepEqual(Object.keys(EXPECTED_VARIANTS).sort(), [...TRAINING_STATUSES].sort());
    for (const status of TRAINING_STATUSES) {
      assert.equal(trainingStatusVariant(status), EXPECTED_VARIANTS[status], status);
    }
    assert.equal(trainingStatusVariant('not_a_real_status'), 'muted');
    assert.equal(trainingStatusVariant(null), 'muted');
    assert.equal(trainingStatusVariant(undefined), 'muted');
  });

  it('keeps Arabic training-status labels for every supported status', () => {
    const labels = loadArabic().trainingStatus;
    for (const status of TRAINING_STATUSES) {
      const label = labels[status];
      assert.equal(typeof label, 'string', status);
      assert.notEqual(label, status);
      assert.doesNotMatch(label, /^[A-Z0-9_]+$/);
    }
  });

  it('imports the shared helper on the eligibility card instead of declaring a local stub', () => {
    const src = readSrc(cardRel);
    assert.match(
      src,
      /import\s*\{\s*trainingStatusVariant\s*\}\s*from\s*['"][^'"]*fieldTrainingUi\.js['"]/
    );
    assert.match(src, /trainingStatusVariant\(trainingStatus\)/);
    assert.doesNotMatch(src, /(?:function|const|let|var)\s+trainingStatusVariant\b/);
  });

  it('renders supported, unknown, and empty training statuses without throwing', async () => {
    const ar = loadArabic();
    const t = createTranslator(ar);
    const { renderStatusCard } = await loadStatusCardRenderer();
    const originalError = console.error;
    console.error = (...args) => {
      const text = args.map((part) => String(part)).join(' ');
      if (text.includes('useLayoutEffect does nothing on the server')) return;
      originalError(...args);
    };
    const cases = [
      { status: 'in_training', variantClass: 'status-badge--info', label: ar.trainingStatus.in_training, showsTraining: true },
      { status: 'completed', variantClass: 'status-badge--success', label: ar.trainingStatus.completed, showsTraining: true },
      { status: 'failed', variantClass: 'status-badge--danger', label: ar.trainingStatus.failed, showsTraining: true },
      { status: 'pre_assessment_completed', variantClass: 'status-badge--muted', label: ar.trainingStatus.pre_assessment_completed, showsTraining: true },
      { status: 'not_a_real_status', variantClass: 'status-badge--muted', label: 'not_a_real_status', showsTraining: true },
      { status: null, showsTraining: false },
      { status: undefined, showsTraining: false },
      { status: 'none', showsTraining: false },
    ];

    try {
      for (const item of cases) {
        const html = renderStatusCard(participant(item.status), t);
        assert.match(html, /طالب تجريبي/);
        assert.match(html, /status-badge/);
        if (item.showsTraining) {
          assert.match(html, new RegExp(item.variantClass));
          assert.match(html, new RegExp(escapeRegExp(`${ar.outcomeSemantics.trainingStatus}: ${item.label}`)));
        } else {
          assert.doesNotMatch(html, /حالة التدريب/);
        }
      }
    } finally {
      console.error = originalError;
    }
  });
});

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function loadStatusCardRenderer() {
  const store = new Map();
  globalThis.localStorage = {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };

  const esbuild = await import('esbuild');
  const frontendRoot = path.join(root, '..');
  const outDir = mkdtempSync(path.join(root, '.tmp-ft-status-'));
  const outfile = path.join(outDir, 'renderStatusCard.mjs');
  try {
    await esbuild.build({
      absWorkingDir: frontendRoot,
      stdin: {
        contents: `
          import { createElement } from 'react';
          import { renderToStaticMarkup } from 'react-dom/server.browser';
          import { MemoryRouter } from 'react-router-dom';
          import { LocaleProvider } from './src/features/locale/index.js';
          import { EligibilityStudentCard } from './src/pages/admin/fieldTraining/components/manage/EligibilityStudentCard.jsx';

          export function renderStatusCard(row, t) {
            return renderToStaticMarkup(
              createElement(
                LocaleProvider,
                null,
                createElement(
                  MemoryRouter,
                  null,
                  createElement(EligibilityStudentCard, {
                    row,
                    opportunity: { required_training_hours: 40 },
                    opportunityId: 'opp-1',
                    apiScope: 'admin',
                    t,
                    onRecalculate: () => {},
                    recalcPending: false,
                  })
                )
              )
            );
          }
        `,
        resolveDir: frontendRoot,
        sourcefile: 'status-render-entry.jsx',
        loader: 'jsx',
      },
      bundle: true,
      format: 'esm',
      platform: 'node',
      outfile,
      jsx: 'automatic',
      logLevel: 'silent',
    });
    return await import(pathToFileURL(outfile).href);
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}

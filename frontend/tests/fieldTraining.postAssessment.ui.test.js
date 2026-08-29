/**
 * Standardized field-training post-assessment UI wiring.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8');
}

describe('field training post-assessment UI', () => {
  it('shows the four Arabic attempt states and saves progress', () => {
    const tab = readSrc('../src/pages/student/fieldTraining/components/StudentAssessmentsTab.jsx');
    const ar = readSrc('../src/i18n/locales/ar/fieldTraining.json');
    const service = readSrc('../src/features/fieldTraining/fieldTraining.service.js');
    assert.match(ar, /"statusNotStarted": "لم يبدأ"/);
    assert.match(ar, /"statusInProgress": "قيد التقديم"/);
    assert.match(ar, /"statusSubmitted": "تم التسليم"/);
    assert.match(ar, /"statusGraded": "تم التصحيح"/);
    assert.match(tab, /saveStudentAssessmentProgress/);
    assert.match(tab, /dir="rtl"/);
    assert.match(service, /assessments\/\$\{type\}\/save/);
  });
});

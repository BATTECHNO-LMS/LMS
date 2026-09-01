'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildImportSupervisorIndex,
  resolveAcademicSupervisorName,
} = require('../src/modules/fieldTraining/fieldTrainingEvaluation.academicSupervisorResolve');
const {
  classifyOfficialReportExclusion,
} = require('../src/modules/fieldTraining/fieldTrainingEvaluation.officialPopulation');

describe('academic supervisor resolve', () => {
  it('resolves supervisor from applied Excel preview by university number', () => {
    const index = buildImportSupervisorIndex([
      {
        preview_json: {
          groups: [
            {
              students: [
                {
                  application_id: 'app-1',
                  university_number: '120252222134',
                  university_email: '120252222134@mutah.edu.jo',
                  proposed_supervisor_name: 'د. أحمد المشرف',
                  errors: [],
                },
              ],
            },
          ],
        },
      },
    ]);
    const resolved = resolveAcademicSupervisorName({
      application: { id: 'app-1', academic_supervisor_name: null },
      student: { email: '120252222134@mutah.edu.jo' },
      importIndex: index,
    });
    assert.equal(resolved.name, 'د. أحمد المشرف');
    assert.equal(resolved.source, 'excel_preview');
  });

  it('returns ACADEMIC_SUPERVISOR_MISSING when not in Excel or application', () => {
    const resolved = resolveAcademicSupervisorName({
      application: { id: 'app-2', academic_supervisor_name: null },
      student: { email: '120232222041@mutah.edu.jo', university_student_number: '120232222041' },
      importIndex: buildImportSupervisorIndex([]),
    });
    assert.equal(resolved.name, null);
    assert.equal(resolved.code, 'ACADEMIC_SUPERVISOR_MISSING');
  });

  it('prefers stored application supervisor text', () => {
    const resolved = resolveAcademicSupervisorName({
      application: { id: 'app-3', academic_supervisor_name: 'د. زكريا الطراونه' },
      student: {},
      importIndex: buildImportSupervisorIndex([]),
    });
    assert.equal(resolved.name, 'د. زكريا الطراونه');
    assert.equal(resolved.source, 'application');
  });
});

describe('official report population exclusion', () => {
  it('excludes BATUNI demo accounts from official Mutah population', () => {
    const result = classifyOfficialReportExclusion({
      student: { email: 'student@batuni.edu', primary_university_id: 'batuni-uni' },
      opportunity: {
        field_training_opportunity_eligibility: [{ university_id: 'mutah-uni' }],
      },
    });
    assert.equal(result.excluded, true);
    assert.equal(result.code, 'TEST_ACCOUNT_EXCLUDED');
  });
});

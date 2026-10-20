'use strict';

const {
  RULES,
} = require('../src/modules/fieldTraining/fieldTraining.smartNotifications');
const { PORTFOLIO_SOURCE } = require('../src/modules/fieldTraining/fieldTraining.portfolio.service');
const { buildPortfolioHtml } = require('../src/modules/fieldTraining/fieldTraining.portfolio.pdf');

describe('field training smart notifications registry', () => {
  test('exposes required rule codes with cooldown', () => {
    expect(RULES.TASK_DUE_SOON.code).toBe('TASK_DUE_SOON');
    expect(RULES.TASK_OVERDUE.cooldownHours).toBeGreaterThan(0);
    expect(RULES.READY_TO_COMPLETE.cooldownHours).toBeGreaterThan(24);
    expect(RULES.RECORDED_LECTURE_NOT_STARTED.delayDays).toBe(3);
    expect(RULES.HOURS_REMAINING.code).toBe('HOURS_REMAINING');
  });
});

describe('portfolio evidence sources', () => {
  test('includes canonical sources and student upload distinction', () => {
    expect(PORTFOLIO_SOURCE.TASK).toBe('TASK');
    expect(PORTFOLIO_SOURCE.LOGBOOK).toBe('LOGBOOK');
    expect(PORTFOLIO_SOURCE.RECORDED_LECTURE).toBe('RECORDED_LECTURE');
    expect(PORTFOLIO_SOURCE.STUDENT_UPLOAD).toBe('STUDENT_UPLOAD');
  });

  test('PDF template marks PRE as not scored and never claims logbook score', () => {
    const html = buildPortfolioHtml({
      student: { name: 'أحمد', number: '123' },
      opportunity: { title: 'تدريب تجريبي', organization_name: 'جهة' },
      score: {
        final: 82,
        components: {
          attendance: { points: 18, maxPoints: 20 },
          postAssessment: { points: 17, maxPoints: 20 },
          tasks: { points: 31, maxPoints: 40 },
          behavior: { points: 16, maxPoints: 20 },
        },
      },
      sections: [
        {
          key: 'assessments',
          title_ar: 'التقييمات',
          items: [{ type: 'pre', completed: true, score: 90 }],
        },
        {
          key: 'logbook',
          title_ar: 'سجل التدريب',
          items: [
            {
              entry_date: '2026-10-01',
              activity: 'عمل على API',
              learning_outcome: 'تعلّم REST',
            },
          ],
        },
        {
          key: 'attendance_hours',
          title_ar: 'الحضور والساعات',
          items: [
            {
              attendance_percentage: 90,
              hours_completed: 74,
              hours_required: 80,
            },
          ],
        },
      ],
    });
    expect(html).toMatch(/dir="rtl"/);
    expect(html).toMatch(/82/);
    expect(html).toMatch(/غير مقيّم في الدرجة/);
    expect(html).toMatch(/ليست درجة/);
    expect(html).not.toMatch(/JWT|storage_key|ip address/i);
    expect(html).toMatch(/معتمد/);
  });
});

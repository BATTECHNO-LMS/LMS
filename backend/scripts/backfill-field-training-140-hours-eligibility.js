'use strict';

/**
 * One-time backfill: FIELD_TRAINING_140_HOURS_ELIGIBILITY_BACKFILL_V1
 *
 * Usage:
 *   node scripts/backfill-field-training-140-hours-eligibility.js
 *   node scripts/backfill-field-training-140-hours-eligibility.js --apply
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { prisma } = require('../src/config/db');
const {
  OPERATION_ID,
  runHoursEligibilityBackfill,
} = require('../src/modules/fieldTraining/fieldTraining.hoursEligibilityBackfill');

const APPLY = process.argv.includes('--apply');

function printArabicReport(result) {
  const c = result.dryRun.counters;
  const lines = [
    `عملية: ${OPERATION_ID}`,
    `الوضع: ${result.apply ? 'تنفيذ' : result.blocked ? 'توقف بسبب أخطاء سلامة' : 'معاينة فقط'}`,
    `الفرص المفحوصة: ${c.opportunitiesScanned}`,
    `التسجيلات المفحوصة: ${c.enrollmentsScanned}`,
    `التسجيلات المقبولة المفحوصة: ${c.acceptedEnrollmentsScanned}`,
    `الطلاب المستوفون للشروط الأربعة: ${c.qualifying}`,
    `سجلات تحتاج تحديثاً: ${c.toUpdate}`,
    `طلاب جُعلوا مؤهلين (بعد التنفيذ): ${result.updatedCount}`,
    `طلاب رُفعت ساعاتُهم إلى 140: ${c.hoursRaisedTo140}`,
    `طلاب كانت ساعاتُهم 140 أو أكثر: ${c.hoursPreservedAbove140}`,
    `طلاب مؤهلون مسبقاً بالساعات المطلوبة: ${c.alreadyEligibleWithHours}`,
    `مستبعدون — طلب غير مقبول: ${c.excluded.enrollment_not_accepted}`,
    `مستبعدون — مستبعد من التدريب: ${c.excluded.expelled}`,
    `مستبعدون — لا تقييم قبلي صالح: ${c.excluded.pre_assessment}`,
    `مستبعدون — لا تسليم مهمة صالح: ${c.excluded.task_submission}`,
    `مستبعدون — لا تقييم بعدي صالح: ${c.excluded.post_assessment}`,
    `مستبعدون — حضور أقل من 80%: ${c.excluded.attendance_below_80}`,
    `مستبعدون — لا جلسات محسوبة: ${c.excluded.zero_counted_sessions}`,
    `سجلات فاشلة/متخطاة: ${c.skippedFailed.length + (result.failed?.length || 0)}`,
    `أخطاء سلامة: ${result.dryRun.integrityErrorCount}`,
    `قيود سجل التدقيق: ${result.auditCount}`,
  ];
  console.log(lines.join('\n'));
  if (c.skippedFailed.length) {
    console.log('فشل/تخطي:', JSON.stringify(c.skippedFailed.slice(0, 20), null, 2));
  }
  if (result.failed?.length) {
    console.log('فشل التنفيذ:', JSON.stringify(result.failed.slice(0, 20), null, 2));
  }
  if (result.dryRun.integrityErrors?.length) {
    console.log('سلامة البيانات:', JSON.stringify(result.dryRun.integrityErrors.slice(0, 20), null, 2));
  }
}

async function main() {
  const result = await runHoursEligibilityBackfill({ apply: APPLY, prisma });
  printArabicReport(result);
  console.log('\nJSON:');
  console.log(
    JSON.stringify(
      {
        operationId: OPERATION_ID,
        apply: result.apply,
        blocked: result.blocked,
        reason: result.reason || null,
        counters: result.dryRun.counters,
        mutationCount: result.dryRun.mutationCount,
        mutationsPreview: result.dryRun.mutations.slice(0, 25),
        updatedCount: result.updatedCount,
        auditCount: result.auditCount,
        failed: result.failed,
        updatedSample: result.updatedSample || [],
      },
      null,
      2
    )
  );
  if (!APPLY && !result.blocked) {
    console.error('\nمعاينة فقط. أعد التشغيل مع --apply للتنفيذ.');
  }
  if (result.blocked) process.exitCode = 2;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

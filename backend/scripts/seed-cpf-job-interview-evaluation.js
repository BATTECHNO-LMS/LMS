'use strict';

/**
 * Idempotent seed: final evaluation template for CPF-JOB-INTERVIEW-2026-08.
 * Run: node scripts/seed-cpf-job-interview-evaluation.js
 *      npm run seed:cpf-job-interview-evaluation
 */

const { prisma } = require('../src/config/db');
const { recordAudit } = require('../src/shared/services/audit.service');

const COURSE_CODE = 'CPF-JOB-INTERVIEW-2026-08';
const TEMPLATE_CODE = 'CPF-JOB-INTERVIEW-2026-EVAL';
const ORG_CODE = 'CROWN_PRINCE_FOUNDATION';

const RATING_LABELS = {
  1: 'لا أوافق بشدة',
  2: 'لا أوافق',
  3: 'محايد',
  4: 'أوافق',
  5: 'أوافق بشدة',
};

const ONLINE_VENUE = [
  'كان رابط الدخول إلى التدريب واضحًا وسهل الاستخدام.',
  'كانت جودة الصوت والصورة مناسبة.',
  'كانت منصة التدريب سهلة الاستخدام.',
  'كانت المواد والروابط متاحة في الوقت المناسب.',
  'كان الدعم الفني والتنظيم الإلكتروني جيدًا.',
];

const INPERSON_VENUE = [
  'كانت تعليمات الوصول إلى مكان التدريب واضحة.',
  'كان مكان التدريب مناسبًا لعدد المتدربين.',
  'كانت القاعة مريحة ونظيفة ومنظمة.',
  'كانت أجهزة العرض والصوت والإنترنت مناسبة.',
  'كان الاستقبال والتنظيم والالتزام بالمواعيد جيدًا.',
];

const HYBRID_VENUE = [
  'كانت تعليمات الحضور والوصول أو الدخول الإلكتروني واضحة.',
  'كان مكان التدريب أو بيئة التدريب الإلكترونية مناسبة.',
  'كانت جودة الصوت والعرض والاتصال مناسبة.',
  'كانت المواد والروابط متاحة في الوقت المناسب.',
  'كان التنظيم والالتزام بالمواعيد جيدًا.',
];

function ratingQ(code, prompt, sortOrder, deliveryModes = null) {
  return {
    code,
    prompt,
    question_type: 'RATING_SCALE',
    is_required: true,
    sort_order: sortOrder,
    scale_min: 1,
    scale_max: 5,
    scale_labels_json: RATING_LABELS,
    delivery_modes_json: deliveryModes,
    max_length: null,
  };
}

async function main() {
  const program = await prisma.training_programs.findUnique({
    where: { code: COURSE_CODE },
    include: { organizations: true },
  });
  if (!program) throw new Error(`Course ${COURSE_CODE} not found`);
  if (program.organizations?.code !== ORG_CODE) {
    throw new Error(`Organization mismatch for ${COURSE_CODE}`);
  }

  const report = { courseId: program.id, templateId: null, questions: 0, linked: false };

  const result = await prisma.$transaction(
    async (tx) => {
      let template = await tx.training_evaluation_templates.findUnique({
        where: { code: TEMPLATE_CODE },
      });
      const templateData = {
        organization_id: program.organization_id,
        code: TEMPLATE_CODE,
        title: 'التقييم النهائي – اجتياز مقابلات العمل',
        description:
          'تقييم ختامي لقياس جودة الدورة والمدرب والمحتوى والأنشطة والأثر المباشر، مع سؤال التوصية (NPS) وملاحظات مفتوحة.',
        delivery_mode: 'ONLINE',
        is_active: true,
        version: 1,
        updated_at: new Date(),
      };
      if (template) {
        template = await tx.training_evaluation_templates.update({
          where: { id: template.id },
          data: templateData,
        });
      } else {
        template = await tx.training_evaluation_templates.create({ data: templateData });
      }

      const sectionsDef = [
        {
          code: 'TRAINER',
          title: 'تقييم المدرب',
          description: 'قيّم أداء المدرب خلال الدورة.',
          indicator_key: 'trainer_score',
          sort_order: 0,
          questions: [
            ratingQ('T1', 'كان المدرب متمكنًا من موضوع الدورة.', 0),
            ratingQ('T2', 'شرح المدرب الأفكار بطريقة واضحة ومنظمة.', 1),
            ratingQ('T3', 'استخدم المدرب أمثلة عملية مرتبطة بواقع الموضوع التدريبي.', 2),
            ratingQ('T4', 'أتاح المدرب فرصة كافية للمشاركة وطرح الأسئلة.', 3),
            ratingQ('T5', 'قدم المدرب ملاحظات ساعدتني على تطوير أدائي.', 4),
          ],
        },
        {
          code: 'CONTENT',
          title: 'تقييم المحتوى والمادة التدريبية',
          description: 'قيّم وضوح المحتوى وارتباطه بأهدافك.',
          indicator_key: 'content_score',
          sort_order: 1,
          questions: [
            ratingQ('C1', 'كانت أهداف الدورة واضحة ومحددة.', 0),
            ratingQ('C2', 'كان المحتوى مرتبطًا باحتياجاتي التدريبية.', 1),
            ratingQ('C3', 'كانت المعلومات مرتبة بتسلسل منطقي.', 2),
            ratingQ('C4', 'كانت المادة التدريبية والشرائح واضحة وسهلة الفهم.', 3),
            ratingQ('C5', 'غطى المحتوى أهم الجوانب اللازمة لتحقيق أهداف الدورة.', 4),
          ],
        },
        {
          code: 'ACTIVITIES',
          title: 'تقييم الأنشطة والتطبيق العملي',
          description: 'قيّم الأنشطة والاختبارات والتغذية الراجعة.',
          indicator_key: 'activities_score',
          sort_order: 2,
          questions: [
            ratingQ('A1', 'ساعدت الأنشطة العملية على تطبيق المعلومات.', 0),
            ratingQ('A2', 'كانت المحاكاة أو التطبيقات العملية مفيدة في تحسين أدائي.', 1),
            ratingQ('A3', 'كان الاختبار القبلي مرتبطًا بموضوعات الدورة.', 2),
            ratingQ('A4', 'كان الاختبار البعدي مناسبًا لقياس ما تعلمته.', 3),
            ratingQ('A5', 'ساعدت التغذية الراجعة على معرفة نقاط قوتي والجوانب التي تحتاج إلى تطوير.', 4),
          ],
        },
        {
          code: 'VENUE_ORG',
          title: 'تقييم البيئة التقنية والتنظيم',
          description: 'الأسئلة تظهر حسب نمط الحضور (حضوري / إلكتروني / هجين).',
          indicator_key: 'organization_score',
          sort_order: 3,
          questions: [
            ...ONLINE_VENUE.map((p, i) => ratingQ(`V_ON_${i + 1}`, p, i, ['ONLINE'])),
            ...INPERSON_VENUE.map((p, i) => ratingQ(`V_IP_${i + 1}`, p, 10 + i, ['IN_PERSON', 'ONSITE', 'OFFLINE'])),
            ...HYBRID_VENUE.map((p, i) => ratingQ(`V_HY_${i + 1}`, p, 20 + i, ['HYBRID'])),
          ],
        },
        {
          code: 'IMPACT',
          title: 'الأثر العام والاستفادة',
          description: 'قيّم الأثر المباشر لهذه الدورة على جاهزيتك لمقابلات العمل.',
          indicator_key: 'immediate_impact_score',
          sort_order: 4,
          questions: [
            ratingQ('I1', 'أصبحت أكثر قدرة على الاستعداد لمقابلة العمل.', 0),
            ratingQ('I2', 'أصبحت أكثر قدرة على تقديم نفسي بصورة مهنية.', 1),
            ratingQ('I3', 'أستطيع استخدام منهجية STAR في الإجابات السلوكية.', 2),
            ratingQ('I4', 'أشعر بثقة أكبر في التعامل مع الأسئلة الصعبة.', 3),
            ratingQ('I5', 'أستطيع تطبيق ما تعلمته في مقابلات عمل فعلية.', 4),
          ],
        },
        {
          code: 'NPS_FEEDBACK',
          title: 'التوصية والملاحظات',
          description: 'شاركنا احتمالية التوصية وأي ملاحظات مفتوحة.',
          indicator_key: null,
          sort_order: 5,
          questions: [
            {
              code: 'NPS1',
              prompt: 'ما مدى احتمالية أن توصي بهذه الدورة لصديق أو زميل؟',
              question_type: 'NPS',
              is_required: true,
              sort_order: 0,
              scale_min: 0,
              scale_max: 10,
              scale_labels_json: { 0: 'غير محتمل إطلاقًا', 10: 'محتمل جدًا' },
              delivery_modes_json: null,
              max_length: null,
            },
            {
              code: 'O1',
              prompt: 'ما أكثر جزء استفدت منه في الدورة؟',
              question_type: 'OPEN_TEXT',
              is_required: false,
              sort_order: 1,
              scale_min: null,
              scale_max: null,
              scale_labels_json: null,
              delivery_modes_json: null,
              max_length: 2000,
            },
            {
              code: 'O2',
              prompt: 'ما التحسين الذي تقترحه على المدرب أو المحتوى أو التنظيم أو مكان التدريب؟',
              question_type: 'OPEN_TEXT',
              is_required: false,
              sort_order: 2,
              scale_min: null,
              scale_max: null,
              scale_labels_json: null,
              delivery_modes_json: null,
              max_length: 2000,
            },
          ],
        },
      ];

      // Replace sections/questions idempotently when no submitted responses exist for this template.
      const submittedCount = await tx.training_evaluation_assignments.count({
        where: { template_id: template.id, status: 'SUBMITTED' },
      });
      if (submittedCount === 0) {
        await tx.training_evaluation_sections.deleteMany({ where: { template_id: template.id } });
        for (const s of sectionsDef) {
          const section = await tx.training_evaluation_sections.create({
            data: {
              template_id: template.id,
              code: s.code,
              title: s.title,
              description: s.description,
              sort_order: s.sort_order,
              indicator_key: s.indicator_key,
            },
          });
          await tx.training_evaluation_questions.createMany({
            data: s.questions.map((q) => ({
              section_id: section.id,
              code: q.code,
              prompt: q.prompt,
              question_type: q.question_type,
              is_required: q.is_required,
              sort_order: q.sort_order,
              scale_min: q.scale_min,
              scale_max: q.scale_max,
              scale_labels_json: q.scale_labels_json ?? undefined,
              delivery_modes_json: q.delivery_modes_json ?? undefined,
              max_length: q.max_length,
            })),
          });
        }
      }

      await tx.training_program_evaluation_links.upsert({
        where: { program_id: program.id },
        create: {
          program_id: program.id,
          template_id: template.id,
          is_required: true,
          is_active: true,
        },
        update: {
          template_id: template.id,
          is_required: true,
          is_active: true,
          updated_at: new Date(),
        },
      });

      await tx.training_requirements.upsert({
        where: { program_id_code: { program_id: program.id, code: 'EVALUATION' } },
        create: {
          program_id: program.id,
          code: 'EVALUATION',
          label: 'تقييم الدورة',
          is_required: true,
          sort_order: 4,
        },
        update: {
          is_required: true,
          label: 'تقييم الدورة',
          updated_at: new Date(),
        },
      });

      const qCount = await tx.training_evaluation_questions.count({
        where: { training_evaluation_sections: { template_id: template.id } },
      });

      return { template, qCount, submittedCount };
    },
    { maxWait: 20000, timeout: 120000 }
  );

  report.templateId = result.template.id;
  report.questions = result.qCount;
  report.linked = true;
  report.submittedAssignmentsPreserved = result.submittedCount;

  // For ONLINE courses, visible question set is 25 ratings + NPS + 2 open = 28
  const onlineVisible = await prisma.training_evaluation_questions.findMany({
    where: {
      training_evaluation_sections: { template_id: result.template.id },
      OR: [{ delivery_modes_json: { equals: null } }, { delivery_modes_json: { path: [], array_contains: 'ONLINE' } }],
    },
  });
  // Prisma JSON filter is finicky; compute in JS
  const allQs = await prisma.training_evaluation_questions.findMany({
    where: { training_evaluation_sections: { template_id: result.template.id } },
    include: { training_evaluation_sections: true },
  });
  const onlineQs = allQs.filter((q) => {
    const raw = q.delivery_modes_json;
    if (!raw) return true;
    const list = Array.isArray(raw) ? raw : [];
    return list.map((m) => String(m).toUpperCase()).includes('ONLINE');
  });

  report.validation = {
    templateActive: result.template.is_active,
    linkedToCourse: true,
    onlineVisibleCount: onlineQs.length,
    onlineVisibleIs28: onlineQs.length === 28,
    ratingCount: onlineQs.filter((q) => q.question_type === 'RATING_SCALE').length,
    npsCount: onlineQs.filter((q) => q.question_type === 'NPS').length,
    openCount: onlineQs.filter((q) => q.question_type === 'OPEN_TEXT').length,
  };

  await recordAudit({
    organizationId: program.organization_id,
    actionType: 'training_evaluation_template.seed',
    entityType: 'training_evaluation_template',
    entityId: result.template.id,
    newValues: { code: TEMPLATE_CODE, courseCode: COURSE_CODE, questions: onlineQs.length },
  }).catch(() => null);

  const ok = report.validation.onlineVisibleIs28 && report.validation.npsCount === 1;
  console.log(JSON.stringify({ ...report, unusedOnlineVisible: onlineVisible.length }, null, 2));
  if (!ok) {
    process.exitCode = 1;
    console.error('VALIDATION_FAILED');
  } else {
    console.log('SEED_OK');
  }
}

if (require.main === module) {
  main()
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect().catch(() => null);
    });
}

module.exports = { COURSE_CODE, TEMPLATE_CODE };

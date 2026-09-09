'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { prisma } = require('../src/config/db');
const { getProvider } = require('../src/shared/storage/storageProvider');
const { inspectTemplateBuffer } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.preflight');

const V11_ID = 'bd3797b2-6131-466a-a41a-25d460105f46';

async function main() {
  const row = await prisma.field_training_evaluation_templates.findUnique({ where: { id: V11_ID } });
  const file = await prisma.files.findFirst({ where: { id: row.original_file_id, deleted_at: null } });
  const buffer = await getProvider().getObjectBuffer(file.storage_key);
  const inspection = await inspectTemplateBuffer(buffer);
  console.log(
    JSON.stringify(
      {
        version: row.version,
        isDefault: row.is_default,
        isActive: row.is_active,
        validationStatus: row.validation_status,
        fillMode: row.validation_json?.fillMode,
        mediaCount: inspection.mediaCount,
        media: inspection.media,
        hasOfficialStampLabel: inspection.hasOfficialStampLabel,
        hasSignatureLabel: inspection.hasSignatureLabel,
        labelForm: inspection.labelForm,
        evaluationGridRecognized: inspection.evaluationGridRecognized,
        mutahOfficial: inspection.mutahOfficial,
        hasCommentsSection: inspection.hasCommentsSection,
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null);
  });

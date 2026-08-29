'use strict';

/**
 * Idempotent: register the official Mutah University Field Training evaluation DOCX
 * as that university's default template. Does not modify other universities.
 *
 * Usage: node scripts/register-mutah-field-training-evaluation-template.js
 *        npm run seed:mutah-ft-eval-template
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const fs = require('fs');
const { prisma } = require('../src/config/db');
const filesService = require('../src/modules/files/files.service');
const { detectUniversityLabelFormFromBuffer } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.docx');
const {
  STORAGE_FOLDER,
  OFFICIAL_MUTAH_TEMPLATE_NAME,
  OFFICIAL_MUTAH_TEMPLATE_FILENAME,
} = require('../src/modules/fieldTraining/fieldTrainingEvaluation.constants');
const {
  MUTAH_NAME_AR,
  MUTAH_DOMAIN,
  officialTemplatePath,
  sha256File,
} = require('./lib/mutahOfficialEvaluationTemplate');

function log(msg) {
  // eslint-disable-next-line no-console
  console.log(`[mutah-ft-eval-template] ${msg}`);
}

async function findMutahUniversity() {
  const byName = await prisma.universities.findFirst({
    where: { name: MUTAH_NAME_AR },
    include: { university_email_domains: { select: { domain: true } } },
  });
  if (byName) return byName;
  const domain = await prisma.university_email_domains.findFirst({
    where: { domain: { equals: MUTAH_DOMAIN, mode: 'insensitive' } },
    include: { universities: true },
  });
  return domain?.universities || null;
}

async function findActorUser() {
  const role = await prisma.roles.findFirst({
    where: { code: 'super_admin' },
    select: { id: true },
  });
  if (!role) return null;
  const link = await prisma.user_roles.findFirst({
    where: { role_id: role.id },
    select: { user_id: true },
    orderBy: { created_at: 'asc' },
  });
  return link ? { id: link.user_id } : null;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }
  const filePath = officialTemplatePath();
  if (!fs.existsSync(filePath)) {
    throw new Error(`Official Mutah template not found: ${filePath}`);
  }
  const buffer = fs.readFileSync(filePath);
  const hash = sha256File(filePath);
  const labelForm = await detectUniversityLabelFormFromBuffer(buffer);
  if (!labelForm) {
    throw new Error('Official Mutah DOCX is not a recognized evaluation label form');
  }

  const university = await findMutahUniversity();
  if (!university) {
    throw new Error(`Mutah University (${MUTAH_NAME_AR} / ${MUTAH_DOMAIN}) was not found`);
  }

  const existingDefault = await prisma.field_training_evaluation_templates.findFirst({
    where: {
      university_id: university.id,
      is_default: true,
      archived_at: null,
    },
    orderBy: { version: 'desc' },
  });
  if (existingDefault?.validation_json?.officialSha256 === hash && existingDefault.is_active) {
    log(`Already registered as default template ${existingDefault.id} (unchanged hash)`);
    return {
      universityId: university.id,
      templateId: existingDefault.id,
      reused: true,
    };
  }

  const actor = await findActorUser();
  const stored = await filesService.storePrivateBuffer({
    buffer,
    originalName: OFFICIAL_MUTAH_TEMPLATE_FILENAME,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    folder: STORAGE_FOLDER,
    user: actor ? { userId: actor.id } : null,
    relatedEntityType: 'field_training_evaluation_template',
    relatedEntityId: university.id,
  });

  const latest = await prisma.field_training_evaluation_templates.findFirst({
    where: { university_id: university.id },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  const version = (latest?.version || 0) + 1;
  const validation = {
    valid: true,
    fillMode: 'label_form',
    officialSha256: hash,
    official: true,
  };

  const created = await prisma.$transaction(async (tx) => {
    if (existingDefault) {
      await tx.field_training_evaluation_templates.update({
        where: { id: existingDefault.id },
        data: { is_default: false, is_active: false, archived_at: new Date(), updated_at: new Date() },
      });
    }
    return tx.field_training_evaluation_templates.create({
      data: {
        university_id: university.id,
        name: OFFICIAL_MUTAH_TEMPLATE_NAME,
        description: 'النموذج المعتمد لتقييم طلبة التدريب الميداني – جامعة مؤتة',
        original_file_id: stored.id,
        version,
        is_active: true,
        is_default: true,
        validation_status: 'valid',
        validation_json: validation,
        created_by_id: actor?.id || null,
      },
    });
  });

  log(`Registered Mutah default template ${created.id} v${created.version}`);
  log('Other universities were not modified. Opportunity overrides were not changed.');
  return {
    universityId: university.id,
    templateId: created.id,
    version: created.version,
    reused: false,
  };
}

if (require.main === module) {
  main()
    .then((result) => {
      log(JSON.stringify(result));
      return prisma.$disconnect();
    })
    .catch(async (err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      await prisma.$disconnect().catch(() => null);
      process.exit(1);
    });
}

module.exports = { main };

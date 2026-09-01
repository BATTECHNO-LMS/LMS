'use strict';

/**
 * Assign Tafila field-training students to academic supervisor د. عبدالله زغاميم.
 *
 * Usage:
 *   node scripts/assign-tafila-academic-supervisor.js
 *   node scripts/assign-tafila-academic-supervisor.js --apply
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { prisma } = require('../src/config/db');
const { recordAudit } = require('../src/utils/auditRecorder');
const parse = require('../src/modules/fieldTraining/fieldTraining.supervisorExcel.parse');

const APPLY = process.argv.includes('--apply');
const SUPERVISOR_LABEL = 'د. عبدالله زغاميم';
const OPERATION_ID = 'FIELD_TRAINING_TAFILA_SUPERVISOR_ASSIGN_ABDULLAH_ZAGHAMIM_V1';

function looksLikeTafila(value) {
  const text = String(value || '');
  return text.includes('الطفيلة') || /tafilah|ttu/i.test(text);
}

async function findSuperAdminId() {
  const rows = await prisma.$queryRaw`
    SELECT u.id
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON r.id = ur.role_id
    WHERE r.code = 'super_admin' AND u.status = 'active'
    LIMIT 1
  `;
  return rows[0]?.id || null;
}

async function loadCandidateUsers() {
  const users = await prisma.users.findMany({
    where: { status: 'active' },
    select: {
      id: true,
      full_name: true,
      email: true,
      primary_university_id: true,
    },
  });
  const links = await prisma.user_roles.findMany({
    where: { user_id: { in: users.map((user) => user.id) } },
    select: { user_id: true, role_id: true },
  });
  const roles = await prisma.roles.findMany({
    select: { id: true, code: true },
  });
  const roleById = new Map(roles.map((row) => [row.id, row.code]));
  const rolesByUser = new Map();
  for (const link of links) {
    const code = roleById.get(link.role_id);
    if (!code) continue;
    if (!rolesByUser.has(link.user_id)) rolesByUser.set(link.user_id, []);
    rolesByUser.get(link.user_id).push(code);
  }
  return users.map((user) => ({
    ...user,
    roles: rolesByUser.get(user.id) || [],
  }));
}

function pickSupervisor(users) {
  const wanted = parse.normalizePersonLabel(SUPERVISOR_LABEL);
  const exact = users.filter((user) => parse.normalizePersonLabel(user.full_name) === wanted);
  if (exact.length === 1) return { status: 'exact', user: exact[0], matches: exact };
  if (exact.length > 1) return { status: 'ambiguous', user: null, matches: exact };

  const byEmail = users.filter((user) => emailKey(user.email) === 'aoz@ttu.edu.jo');
  if (byEmail.length === 1) return { status: 'email', user: byEmail[0], matches: byEmail };

  const latin = users.filter((user) => /abdallah|abdullah/i.test(user.full_name || '') && /zagameem|zaghamim|zughaim/i.test(user.full_name || ''));
  if (latin.length === 1) return { status: 'latin_name', user: latin[0], matches: latin };
  if (latin.length > 1) return { status: 'ambiguous', user: null, matches: latin };

  const loose = users.filter((user) => {
    const name = parse.normalizePersonLabel(user.full_name);
    return name.includes('عبدالله') && (name.includes('زغاميم') || name.includes('زغمام'));
  });
  if (loose.length === 1) return { status: 'loose', user: loose[0], matches: loose };
  if (loose.length > 1) return { status: 'ambiguous', user: null, matches: loose };
  return { status: 'missing', user: null, matches: [] };
}

function emailKey(value) {
  return String(value || '').trim().toLowerCase();
}

async function main() {
  const universities = await prisma.universities.findMany({
    select: { id: true, name: true, name_en: true, code: true },
  });
  const university = universities.find(
    (row) => looksLikeTafila(row.name) || looksLikeTafila(row.name_en) || looksLikeTafila(row.code)
  );
  if (!university) {
    throw new Error('لم يتم العثور على جامعة الطفيلة التقنية');
  }

  const opportunities = await prisma.field_training_opportunities.findMany({
    select: { id: true, title: true, status: true, university_id: true },
  });
  const tafilaOpportunities = opportunities.filter((row) => looksLikeTafila(row.title));
  if (!tafilaOpportunities.length) {
    throw new Error('لم يتم العثور على فرصة تدريب ميداني لجامعة الطفيلة');
  }

  const users = await loadCandidateUsers();
  const resolved = pickSupervisor(users);
  const opportunityIds = tafilaOpportunities.map((row) => row.id);
  const applications = await prisma.field_training_applications.findMany({
    where: {
      opportunity_id: { in: opportunityIds },
      status: 'approved',
      expelled_at: null,
      training_status: { not: 'expelled' },
    },
    select: { id: true, student_id: true, status: true, training_status: true, opportunity_id: true },
    orderBy: { created_at: 'asc' },
  });
  const existing = await prisma.field_training_academic_supervisor_assignments.findMany({
    where: { application_id: { in: applications.map((app) => app.id) } },
    select: { application_id: true, supervisor_user_id: true },
  });
  const existingByApp = new Map(existing.map((row) => [row.application_id, row.supervisor_user_id]));

  const report = {
    operation: OPERATION_ID,
    apply: APPLY,
    university: { id: university.id, name: university.name },
    opportunities: tafilaOpportunities,
    supervisorStatus: resolved.status,
    supervisor: resolved.user
      ? {
          id: resolved.user.id,
          full_name: resolved.user.full_name,
          email: resolved.user.email,
          roles: resolved.user.roles,
          primary_university_id: resolved.user.primary_university_id,
        }
      : null,
    matches: resolved.matches.map((user) => ({
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      roles: user.roles,
    })),
    studentsScanned: applications.length,
    alreadyAssigned: 0,
    toCreate: 0,
    toUpdate: 0,
    displayNameUpdated: false,
    created: 0,
    updated: 0,
    unchanged: 0,
  };

  if (!['exact', 'loose', 'email', 'latin_name'].includes(resolved.status)) {
    console.log(JSON.stringify(report, null, 2));
    throw new Error(
      resolved.status === 'ambiguous'
        ? 'يوجد أكثر من حساب مطابق لاسم المشرف. يلزم اختيار الحساب يدوياً.'
        : 'لم يتم العثور على حساب للمشرف د. عبدالله زغاميم'
    );
  }

  const supervisor = resolved.user;
  const actorId = await findSuperAdminId();
  const now = new Date();
  const mutations = applications.map((app) => {
    const current = existingByApp.has(app.id) ? existingByApp.get(app.id) : null;
    if (!current) {
      report.toCreate += 1;
      return { app, action: 'created', previous: null };
    }
    if (String(current) === String(supervisor.id)) {
      report.alreadyAssigned += 1;
      return { app, action: 'unchanged', previous: current };
    }
    report.toUpdate += 1;
    return { app, action: 'reassigned', previous: current };
  });

  if (!APPLY) {
    console.log(JSON.stringify({ ...report, dryRun: true }, null, 2));
    console.error('\nمعاينة فقط. أعد التشغيل مع --apply للتنفيذ.');
    return;
  }

  const normalizedName = parse.normalizePersonLabel(SUPERVISOR_LABEL);
  const createdItems = mutations.filter((item) => item.action === 'created');
  const reassignedItems = mutations.filter((item) => item.action === 'reassigned');
  const unchangedItems = mutations.filter((item) => item.action === 'unchanged');

  await prisma.$transaction(
    async (tx) => {
      if (supervisor.full_name !== SUPERVISOR_LABEL) {
        await tx.users.update({
          where: { id: supervisor.id },
          data: { full_name: SUPERVISOR_LABEL, updated_at: now },
        });
        report.displayNameUpdated = true;
      }

      const mapping = await tx.field_training_supervisor_name_mappings.findFirst({
        where: { university_id: university.id, normalized_name: normalizedName },
      });
      if (mapping) {
        await tx.field_training_supervisor_name_mappings.update({
          where: { id: mapping.id },
          data: {
            supervisor_user_id: supervisor.id,
            display_name: SUPERVISOR_LABEL,
            supervisor_email: supervisor.email,
            updated_at: now,
          },
        });
      } else {
        await tx.field_training_supervisor_name_mappings.create({
          data: {
            university_id: university.id,
            normalized_name: normalizedName,
            display_name: SUPERVISOR_LABEL,
            supervisor_user_id: supervisor.id,
            supervisor_email: supervisor.email,
            created_by_id: actorId,
          },
        });
      }

      if (createdItems.length) {
        await tx.field_training_academic_supervisor_assignments.createMany({
          data: createdItems.map((item) => ({
            application_id: item.app.id,
            student_id: item.app.student_id,
            opportunity_id: item.app.opportunity_id,
            university_id: university.id,
            supervisor_user_id: supervisor.id,
            assigned_by_id: actorId,
            assigned_at: now,
          })),
          skipDuplicates: true,
        });
      }

      for (const item of reassignedItems) {
        await tx.field_training_academic_supervisor_assignments.update({
          where: { application_id: item.app.id },
          data: {
            supervisor_user_id: supervisor.id,
            assigned_by_id: actorId,
            assigned_at: now,
            updated_at: now,
          },
        });
      }
    },
    { timeout: 120000, maxWait: 20000 }
  );

  report.created = createdItems.length;
  report.updated = reassignedItems.length;
  report.unchanged = unchangedItems.length;

  for (const item of mutations) {
    if (item.action === 'unchanged') continue;
    await recordAudit({
      userId: actorId,
      universityId: university.id,
      actionType: OPERATION_ID,
      entityType: 'field_training_application',
      entityId: item.app.id,
      oldValues: {
        supervisor_user_id: item.previous,
      },
      newValues: {
        operation: OPERATION_ID,
        student_id: item.app.student_id,
        enrollment_id: item.app.id,
        opportunity_id: item.app.opportunity_id,
        university_id: university.id,
        previous_supervisor_id: item.previous,
        new_supervisor_id: supervisor.id,
        supervisor_name: SUPERVISOR_LABEL,
        acting_admin_id: actorId,
        executed_at: now.toISOString(),
      },
    });
  }

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

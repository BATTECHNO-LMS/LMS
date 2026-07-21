'use strict';

/**
 * Repair university scope for university-scoped roles (academic_reviewer, admin, instructor).
 *
 * Official source: users.primary_university_id
 * Membership mirror: university_users (relationship_type)
 *
 * Fixes only broken cases:
 *  A) primary_university_id set, but no matching university_users row → upsert membership
 *  B) primary_university_id null, exactly one university_users row → set primary from membership
 *
 * Never deletes data. Never changes healthy users. Never invents a university.
 *
 * Usage:
 *   node scripts/repair-university-scope.js --dry-run
 *   node scripts/repair-university-scope.js --apply
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');
const { normalizeRoleCodes } = require('../src/utils/roleCanon');

const prisma = new PrismaClient();
const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const DRY = !APPLY;

const SCOPED_ROLES = new Set(['academic_reviewer', 'admin', 'instructor', 'student']);

function relationshipForRoles(roles) {
  if (roles.includes('academic_reviewer')) return 'reviewer';
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('instructor')) return 'instructor';
  if (roles.includes('student')) return 'student';
  return 'member';
}

async function loadScopedUsers() {
  const roles = await prisma.roles.findMany({
    where: { code: { in: [...SCOPED_ROLES] } },
    select: { id: true, code: true },
  });
  const roleById = Object.fromEntries(roles.map((r) => [r.id, r.code]));
  const links = await prisma.user_roles.findMany({
    where: { role_id: { in: roles.map((r) => r.id) } },
    select: { user_id: true, role_id: true },
  });
  const byUser = new Map();
  for (const link of links) {
    const list = byUser.get(link.user_id) || [];
    list.push(roleById[link.role_id]);
    byUser.set(link.user_id, list);
  }
  const users = await prisma.users.findMany({
    where: { id: { in: [...byUser.keys()] } },
    select: {
      id: true,
      email: true,
      full_name: true,
      status: true,
      primary_university_id: true,
    },
  });
  return users.map((u) => ({
    ...u,
    roles_raw: byUser.get(u.id) || [],
    roles: normalizeRoleCodes(byUser.get(u.id) || []),
  }));
}

async function planRepairs(users) {
  const plan = [];
  for (const user of users) {
    if (user.roles.includes('super_admin')) continue;
    if (!user.roles.some((r) => SCOPED_ROLES.has(r))) continue;

    const memberships = await prisma.university_users.findMany({
      where: { user_id: user.id },
      select: { id: true, university_id: true, relationship_type: true },
    });
    const primary = user.primary_university_id;
    const hasMatchingMembership = primary
      ? memberships.some((m) => String(m.university_id) === String(primary))
      : false;

    if (primary && !hasMatchingMembership) {
      plan.push({
        user_id: user.id,
        email: user.email,
        roles: user.roles,
        action: 'upsert_university_users',
        primary_university_id: primary,
        relationship_type: relationshipForRoles(user.roles),
        reason: 'primary_university_id set but university_users membership missing',
      });
      continue;
    }

    if (!primary && memberships.length === 1) {
      plan.push({
        user_id: user.id,
        email: user.email,
        roles: user.roles,
        action: 'set_primary_from_membership',
        primary_university_id: memberships[0].university_id,
        relationship_type: memberships[0].relationship_type,
        reason: 'primary_university_id null with exactly one university_users row',
      });
      continue;
    }

    if (!primary && memberships.length > 1) {
      plan.push({
        user_id: user.id,
        email: user.email,
        roles: user.roles,
        action: 'manual_review',
        primary_university_id: null,
        memberships: memberships.map((m) => m.university_id),
        reason: 'multiple university_users and no primary — skipped',
      });
    }
  }
  return plan;
}

async function applyPlan(plan) {
  let applied = 0;
  let skipped = 0;
  for (const row of plan) {
    if (row.action === 'manual_review') {
      skipped += 1;
      continue;
    }
    await prisma.$transaction(async (tx) => {
      if (row.action === 'set_primary_from_membership') {
        await tx.users.update({
          where: { id: row.user_id },
          data: {
            primary_university_id: row.primary_university_id,
            updated_at: new Date(),
          },
        });
      }
      if (
        row.action === 'upsert_university_users' ||
        row.action === 'set_primary_from_membership'
      ) {
        const existing = await tx.university_users.findFirst({
          where: {
            user_id: row.user_id,
            university_id: row.primary_university_id,
          },
        });
        if (existing) {
          await tx.university_users.update({
            where: { id: existing.id },
            data: {
              relationship_type: row.relationship_type || existing.relationship_type,
              updated_at: new Date(),
            },
          });
        } else {
          await tx.university_users.create({
            data: {
              user_id: row.user_id,
              university_id: row.primary_university_id,
              relationship_type: row.relationship_type || 'member',
            },
          });
        }
      }
    });
    applied += 1;
  }
  return { applied, skipped };
}

async function main() {
  console.log(DRY ? 'Mode: DRY-RUN (no writes)' : 'Mode: APPLY');
  const users = await loadScopedUsers();
  const plan = await planRepairs(users);
  const actionable = plan.filter((p) => p.action !== 'manual_review');
  const manual = plan.filter((p) => p.action === 'manual_review');

  console.log(
    JSON.stringify(
      {
        scanned_users: users.length,
        actionable: actionable.length,
        manual_review: manual.length,
        plan,
      },
      null,
      2
    )
  );

  if (DRY) {
    console.log('\nRe-run with --apply to write changes.');
    return;
  }

  const result = await applyPlan(plan);
  console.log('\nApplied:', result);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

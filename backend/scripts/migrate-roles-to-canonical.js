'use strict';

/**
 * Safe role remapping: legacy → canonical (admin / academic_reviewer).
 *
 * Usage:
 *   node scripts/migrate-roles-to-canonical.js           # dry-run (default)
 *   node scripts/migrate-roles-to-canonical.js --dry-run
 *   node scripts/migrate-roles-to-canonical.js --apply    # writes DB
 *   node scripts/migrate-roles-to-canonical.js --ensure-roles  # upsert catalog only
 *   node scripts/migrate-roles-to-canonical.js --retire-legacy  # delete unused legacy role rows
 *
 * Never promotes anyone to super_admin.
 * Never deletes users or audit logs.
 * Never clears users.primary_university_id or university_users — only remaps user_roles.
 * If membership/primary drift exists after remap, use scripts/repair-university-scope.js.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');
const {
  LEGACY_ROLE_ALIASES,
  CANONICAL_ROLE_CODES,
  ROLE_META,
} = require('../src/utils/roleCanon');

const prisma = new PrismaClient();

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const ENSURE_ONLY = args.has('--ensure-roles');
const RETIRE_LEGACY = args.has('--retire-legacy');
const DRY = !APPLY && !RETIRE_LEGACY;

async function ensureCanonicalRoles() {
  const results = [];
  for (const code of CANONICAL_ROLE_CODES) {
    const meta = ROLE_META[code];
    const row = await prisma.roles.upsert({
      where: { code },
      create: {
        code,
        name: meta.name,
        scope: meta.scope,
        description: meta.description || null,
      },
      update: {
        name: meta.name,
        scope: meta.scope,
      },
    });
    results.push({ code: row.code, id: row.id, action: 'upserted' });
  }
  return results;
}

async function auditAndMigrate() {
  const allRoles = await prisma.roles.findMany({
    select: { id: true, code: true, name: true, scope: true },
  });
  const byCode = Object.fromEntries(allRoles.map((r) => [r.code, r]));

  const counts = {};
  for (const role of allRoles) {
    const n = await prisma.user_roles.count({ where: { role_id: role.id } });
    counts[role.code] = n;
  }

  const plan = [];
  const conflicts = [];

  for (const [legacyCode, targetCode] of Object.entries(LEGACY_ROLE_ALIASES)) {
    const legacy = byCode[legacyCode];
    const target = byCode[targetCode];
    if (!legacy) {
      plan.push({ legacyCode, targetCode, users: 0, note: 'legacy role missing in catalog' });
      continue;
    }
    if (!target) {
      plan.push({
        legacyCode,
        targetCode,
        users: counts[legacyCode] || 0,
        note: 'TARGET ROLE MISSING — run --ensure-roles first',
        blocked: true,
      });
      continue;
    }

    const links = await prisma.user_roles.findMany({
      where: { role_id: legacy.id },
      select: { user_id: true },
    });

    const userIds = links.map((l) => l.user_id);
    const users = userIds.length
      ? await prisma.users.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            email: true,
            full_name: true,
            primary_university_id: true,
            status: true,
          },
        })
      : [];
    const userById = Object.fromEntries(users.map((u) => [u.id, u]));

    for (const link of links) {
      const profile = userById[link.user_id];
      const existingTarget = await prisma.user_roles.findFirst({
        where: { user_id: link.user_id, role_id: target.id },
      });
      const otherRoles = await prisma.user_roles.findMany({
        where: { user_id: link.user_id },
        select: { role_id: true },
      });
      const otherRoleIds = otherRoles.map((r) => r.role_id);
      const otherRoleRows = otherRoleIds.length
        ? await prisma.roles.findMany({
            where: { id: { in: otherRoleIds } },
            select: { code: true },
          })
        : [];
      const codes = otherRoleRows.map((r) => r.code);
      const multi = codes.length > 1;
      if (multi) {
        conflicts.push({
          user_id: link.user_id,
          email: profile?.email,
          roles: codes,
          primary_university_id: profile?.primary_university_id,
        });
      }
      plan.push({
        user_id: link.user_id,
        email: profile?.email,
        full_name: profile?.full_name,
        status: profile?.status,
        primary_university_id: profile?.primary_university_id,
        from: legacyCode,
        to: targetCode,
        already_has_target: Boolean(existingTarget),
        action: existingTarget ? 'delete_legacy_link_only' : 'repoint_or_create_then_delete_legacy',
      });
    }
  }

  return { counts, plan, conflicts, byCode };
}

async function applyPlan(plan, byCode) {
  let updated = 0;
  let deletedOnly = 0;
  for (const row of plan) {
    if (!row.user_id || row.blocked) continue;
    const legacy = byCode[row.from];
    const target = byCode[row.to];
    if (!legacy || !target) continue;

    await prisma.$transaction(async (tx) => {
      if (!row.already_has_target) {
        await tx.user_roles.create({
          data: { user_id: row.user_id, role_id: target.id },
        });
        updated += 1;
      } else {
        deletedOnly += 1;
      }
      await tx.user_roles.deleteMany({
        where: { user_id: row.user_id, role_id: legacy.id },
      });
    });
  }
  return { updated, deletedOnly };
}

/**
 * After all users are remapped: delete orphan role_permissions + legacy roles rows.
 * Aborts if any legacy role still has user_roles.
 */
async function retireLegacyRoles({ apply }) {
  const legacyCodes = Object.keys(LEGACY_ROLE_ALIASES);
  const legacyRoles = await prisma.roles.findMany({
    where: { code: { in: legacyCodes } },
    select: { id: true, code: true, name: true },
  });

  if (!legacyRoles.length) {
    console.log('\nNo legacy role catalog rows found — nothing to retire.');
    return { deletedRoles: 0, deletedPermissionLinks: 0, blocked: [] };
  }

  const blocked = [];
  for (const role of legacyRoles) {
    const users = await prisma.user_roles.count({ where: { role_id: role.id } });
    if (users > 0) {
      blocked.push({ code: role.code, users });
    }
  }

  if (blocked.length) {
    console.error('\nBLOCKED retire-legacy: remapped users still linked to legacy roles:');
    for (const b of blocked) {
      console.error(`  ${b.code}: ${b.users} user_roles`);
    }
    console.error('Run --apply first, then re-run --retire-legacy.');
    return { deletedRoles: 0, deletedPermissionLinks: 0, blocked };
  }

  console.log('\n--- Legacy roles ready to retire (0 user_roles each) ---');
  for (const role of legacyRoles) {
    const permLinks = await prisma.role_permissions.count({ where: { role_id: role.id } });
    console.log(`  ${role.code} (${role.name}) — role_permissions: ${permLinks}`);
  }

  if (!apply) {
    console.log('\nDry-run: re-run with --retire-legacy to delete these catalog rows.');
    return { deletedRoles: 0, deletedPermissionLinks: 0, blocked: [] };
  }

  const roleIds = legacyRoles.map((r) => r.id);
  const result = await prisma.$transaction(async (tx) => {
    const deletedPermissionLinks = await tx.role_permissions.deleteMany({
      where: { role_id: { in: roleIds } },
    });
    // Orphan user_roles for these ids (should be 0) — never touch users table.
    const deletedUserRoleLinks = await tx.user_roles.deleteMany({
      where: { role_id: { in: roleIds } },
    });
    const deletedRoles = await tx.roles.deleteMany({
      where: { id: { in: roleIds } },
    });
    return {
      deletedPermissionLinks: deletedPermissionLinks.count,
      deletedUserRoleLinks: deletedUserRoleLinks.count,
      deletedRoles: deletedRoles.count,
    };
  });

  console.log('\nRetired:', result);
  return { ...result, blocked: [] };
}

async function main() {
  console.log('=== BATTECHNO role migration ===');
  if (RETIRE_LEGACY) {
    console.log('MODE: RETIRE-LEGACY');
  } else if (ENSURE_ONLY) {
    console.log('MODE: ENSURE-ROLES');
  } else if (APPLY) {
    console.log('MODE: APPLY');
  } else {
    console.log('MODE: DRY-RUN (no writes except --ensure-roles)');
  }

  const ensured = await ensureCanonicalRoles();
  console.log('\nCanonical roles ensured:', ensured);

  if (ENSURE_ONLY) {
    await prisma.$disconnect();
    return;
  }

  if (RETIRE_LEGACY) {
    const retire = await retireLegacyRoles({ apply: true });
    if (retire.blocked?.length) process.exitCode = 1;
    await prisma.$disconnect();
    return;
  }

  const { counts, plan, conflicts, byCode } = await auditAndMigrate();

  console.log('\n--- User counts by role.code (before) ---');
  for (const [code, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${code}: ${n}`);
  }

  console.log(`\n--- Remap plan (${plan.filter((p) => p.user_id).length} user links) ---`);
  const sample = plan.filter((p) => p.user_id).slice(0, 30);
  for (const row of sample) {
    console.log(
      `  ${row.email} | ${row.from} → ${row.to} | uni=${row.primary_university_id || 'null'} | ${row.action}`
    );
  }
  if (plan.filter((p) => p.user_id).length > 30) {
    console.log(`  … and ${plan.filter((p) => p.user_id).length - 30} more`);
  }

  console.log(`\n--- Multi-role users (conflicts / review) (${conflicts.length}) ---`);
  for (const c of conflicts.slice(0, 40)) {
    console.log(`  ${c.email}: [${c.roles.join(', ')}] uni=${c.primary_university_id || 'null'}`);
  }

  const blocked = plan.filter((p) => p.blocked);
  if (blocked.length) {
    console.error('\nBLOCKED: missing target roles. Aborting apply.');
    process.exitCode = 1;
    await prisma.$disconnect();
    return;
  }

  if (APPLY) {
    const result = await applyPlan(plan, byCode);
    console.log('\nApplied:', result);
    const after = {};
    for (const role of await prisma.roles.findMany({ select: { id: true, code: true } })) {
      after[role.code] = await prisma.user_roles.count({ where: { role_id: role.id } });
    }
    console.log('\n--- User counts by role.code (after) ---');
    for (const [code, n] of Object.entries(after).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${code}: ${n}`);
    }
    console.log('\nNext: node scripts/migrate-roles-to-canonical.js --retire-legacy');
  } else {
    console.log('\nDry-run complete. Re-run with --apply to write changes.');
    console.log('After --apply, run --retire-legacy to remove empty legacy role rows.');
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});

'use strict';

/**
 * Upsert permission catalog + default role_permissions for the five canonical roles.
 *
 *   node scripts/ensure-permission-catalog.js
 *   node scripts/ensure-permission-catalog.js --reset-defaults  # replace role_permissions with defaults
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');
const {
  buildPermissionDefinitions,
  defaultRolePermissionMap,
} = require('../src/utils/permissionCatalog');
const { CANONICAL_ROLE_CODES: ROLES } = require('../src/utils/roleCanon');

const prisma = new PrismaClient();
const RESET = process.argv.includes('--reset-defaults');

async function main() {
  const defs = buildPermissionDefinitions();
  console.log(`Ensuring ${defs.length} permissions…`);

  for (const def of defs) {
    await prisma.permissions.upsert({
      where: { code: def.code },
      create: {
        code: def.code,
        name: def.name,
        module: def.module,
        description: def.description,
      },
      update: {
        name: def.name,
        module: def.module,
        description: def.description,
        updated_at: new Date(),
      },
    });
  }

  const perms = await prisma.permissions.findMany({ select: { id: true, code: true } });
  const idByCode = new Map(perms.map((p) => [p.code, p.id]));

  const defaults = defaultRolePermissionMap();
  for (const roleCode of ROLES) {
    const role = await prisma.roles.findUnique({ where: { code: roleCode } });
    if (!role) {
      console.warn(`Role missing: ${roleCode} — run migrate-roles --ensure-roles first`);
      continue;
    }
    const codes = defaults[roleCode] || [];
    const permIds = codes.map((c) => idByCode.get(c)).filter(Boolean);

    if (RESET) {
      await prisma.role_permissions.deleteMany({ where: { role_id: role.id } });
    }

    const existing = await prisma.role_permissions.findMany({
      where: { role_id: role.id },
      select: { permission_id: true },
    });
    const have = new Set(existing.map((e) => e.permission_id));
    const toCreate = permIds.filter((id) => !have.has(id));
    if (toCreate.length) {
      await prisma.role_permissions.createMany({
        data: toCreate.map((permission_id) => ({ role_id: role.id, permission_id })),
        skipDuplicates: true,
      });
    }
    console.log(`${roleCode}: ${permIds.length} default codes (added ${toCreate.length})`);
  }

  console.log('Done.');
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});

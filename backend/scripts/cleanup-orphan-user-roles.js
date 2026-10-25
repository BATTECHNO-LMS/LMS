'use strict';

/**
 * Delete user_roles rows that point at missing users (no FK cascade on user_roles).
 * Safe / idempotent. Does not touch users.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { prisma } = require('../src/config/db');
const usersRepository = require('../src/modules/users/users.repository');

async function main() {
  const before = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS n
    FROM user_roles ur
    LEFT JOIN users u ON u.id = ur.user_id
    WHERE u.id IS NULL
  `;
  const orphanBefore = Number(before?.[0]?.n || 0);
  const deleted = await usersRepository.deleteOrphanUserRoles();
  console.log(JSON.stringify({ orphanBefore, deleted }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

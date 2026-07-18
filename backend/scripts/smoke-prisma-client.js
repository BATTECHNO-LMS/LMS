require('dotenv').config();
// Prefer explicit disposable URL when provided by the shell.
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const users = await p.users.count();
  const roles = await p.roles.count();
  const ok = await p.$queryRawUnsafe('SELECT 1::int AS ok');
  console.log(JSON.stringify({ users, roles, ok }));
})()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());

const { prisma } = require('../../config/db');

async function findModules({ micro_credential_id, search, skip, take }) {
  const where = {};
  if (micro_credential_id) where.micro_credential_id = micro_credential_id;
  if (search) {
    where.title = { contains: search, mode: 'insensitive' };
  }

  const [total, rows] = await Promise.all([
    prisma.modules.count({ where }),
    prisma.modules.findMany({
      where,
      skip,
      take,
      orderBy: [{ micro_credential_id: 'asc' }, { sequence_no: 'asc' }],
      select: {
        id: true,
        micro_credential_id: true,
        title: true,
        description: true,
        sequence_no: true,
        is_published: true,
        created_at: true,
        updated_at: true,
      },
    }),
  ]);

  if (!rows.length) return { modules: [], total };

  const moduleIds = rows.map((m) => m.id);
  const mcIds = [...new Set(rows.map((m) => m.micro_credential_id))];

  const [contentCounts, microCredentials] = await Promise.all([
    prisma.contents.groupBy({
      by: ['module_id'],
      where: { module_id: { in: moduleIds } },
      _count: { module_id: true },
    }),
    prisma.micro_credentials.findMany({
      where: { id: { in: mcIds } },
      select: { id: true, title: true, code: true },
    }),
  ]);

  const contentMap = new Map(contentCounts.map((c) => [c.module_id, c._count.module_id]));
  const mcMap = new Map(microCredentials.map((m) => [m.id, m]));

  const modules = rows.map((m) => ({
    ...m,
    contents_count: contentMap.get(m.id) ?? 0,
    micro_credential: mcMap.get(m.micro_credential_id) ?? null,
  }));

  return { modules, total };
}

module.exports = { findModules };

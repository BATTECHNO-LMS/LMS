const repo = require('./modules.repository');

async function listModules(query) {
  const page = query.page;
  const page_size = query.page_size;
  const skip = (page - 1) * page_size;
  const { modules, total } = await repo.findModules({
    micro_credential_id: query.micro_credential_id,
    search: query.search,
    skip,
    take: page_size,
  });
  return {
    modules,
    meta: {
      page,
      page_size,
      total,
      total_pages: Math.max(1, Math.ceil(total / page_size)),
    },
  };
}

module.exports = { listModules };

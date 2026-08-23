const repo = require('./modules.repository');
const { buildListMeta } = require('../../utils/pagination');

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
    meta: buildListMeta(total, page, page_size),
  };
}

module.exports = { listModules };

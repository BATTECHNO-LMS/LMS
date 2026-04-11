const usersRepository = require('./users.repository');

async function listUsers(query) {
  const take = query?.take ?? 50;
  return usersRepository.findMany(take);
}

module.exports = { listUsers };

const universitiesRepository = require('./universities.repository');

function listUniversities() {
  return universitiesRepository.findAllActive();
}

module.exports = { listUniversities };

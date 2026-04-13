const { ApiError } = require('../../utils/apiError');
const learningOutcomesRepository = require('./learningOutcomes.repository');
const microCredentialsRepository = require('../micro-credentials/microCredentials.repository');

async function assertMicroCredentialAccess(microCredentialId, requester) {
  const mc = await microCredentialsRepository.findById(microCredentialId);
  if (!mc) throw new ApiError(404, 'Micro-credential not found');
  if (!requester.isGlobal && requester.universityId) {
    const links = await microCredentialsRepository.findUniversityLinks(microCredentialId);
    const ok = links.some((l) => l.university_id === requester.universityId);
    if (!ok) throw new ApiError(403, 'Forbidden');
  }
  return mc;
}

async function assertLearningOutcomeAccess(outcomeId, requester) {
  const row = await learningOutcomesRepository.findById(outcomeId);
  if (!row) throw new ApiError(404, 'Learning outcome not found');
  await assertMicroCredentialAccess(row.micro_credential_id, requester);
  return row;
}

async function listByMicroCredentialId(microCredentialId, requester) {
  await assertMicroCredentialAccess(microCredentialId, requester);
  const items = await learningOutcomesRepository.findByMicroCredentialId(microCredentialId);
  return { learning_outcomes: items };
}

async function getById(id, requester) {
  await assertLearningOutcomeAccess(id, requester);
  return learningOutcomesRepository.findById(id);
}

async function createForMicroCredential(microCredentialId, body, requester) {
  await assertMicroCredentialAccess(microCredentialId, requester);
  try {
    const created = await learningOutcomesRepository.create({
      micro_credential_id: microCredentialId,
      outcome_code: body.outcome_code,
      outcome_text: body.outcome_text,
      outcome_type: body.outcome_type ?? null,
    });
    return getById(created.id, requester);
  } catch (e) {
    if (e && e.code === 'P2002') {
      throw new ApiError(409, 'Outcome code already exists for this micro-credential');
    }
    throw e;
  }
}

async function updateLearningOutcome(id, body, requester) {
  await assertLearningOutcomeAccess(id, requester);

  const data = { updated_at: new Date() };
  if (body.outcome_code !== undefined) data.outcome_code = body.outcome_code;
  if (body.outcome_text !== undefined) data.outcome_text = body.outcome_text;
  if (body.outcome_type !== undefined) data.outcome_type = body.outcome_type;

  try {
    await learningOutcomesRepository.update(id, data);
    return getById(id, requester);
  } catch (e) {
    if (e && e.code === 'P2002') {
      throw new ApiError(409, 'Outcome code already exists for this micro-credential');
    }
    throw e;
  }
}

async function deleteLearningOutcome(id, requester) {
  await assertLearningOutcomeAccess(id, requester);
  await learningOutcomesRepository.remove(id);
  return { id };
}

module.exports = {
  listByMicroCredentialId,
  getById,
  createForMicroCredential,
  updateLearningOutcome,
  deleteLearningOutcome,
};

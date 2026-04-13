const { ApiError } = require('../../utils/apiError');
const repo = require('./rubrics.repository');

function mapRubricList(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    criteria_count: row._count?.rubric_criteria ?? 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapCriterion(c) {
  return {
    id: c.id,
    rubric_id: c.rubric_id,
    criterion_name: c.criterion_name,
    criterion_description: c.criterion_description,
    weight: c.weight != null ? Number(c.weight) : null,
    created_at: c.created_at,
    updated_at: c.updated_at,
  };
}

function mapRubricDetail(row) {
  if (!row) return null;
  const criteria = (row.rubric_criteria || []).map(mapCriterion);
  const sum = criteria.reduce((a, c) => a + (Number(c.weight) || 0), 0);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    criteria,
    criteria_weight_sum: sum,
    criteria_weights_valid: Math.abs(sum - 100) < 0.01,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function listRubrics(query) {
  const where = {};
  if (query.status) where.status = query.status;
  if (query.search) {
    where.title = { contains: query.search, mode: 'insensitive' };
  }
  const rows = await repo.findMany(where, { take: 200 });
  return { rubrics: rows.map(mapRubricList) };
}

async function getRubricById(id) {
  const row = await repo.findById(id);
  if (!row) throw new ApiError(404, 'Rubric not found');
  return mapRubricDetail(row);
}

async function createRubric(body) {
  const row = await repo.create({
    title: body.title.trim(),
    description: body.description ?? null,
    status: body.status || 'active',
  });
  const full = await repo.findById(row.id);
  return mapRubricDetail(full);
}

async function updateRubric(id, body) {
  const existing = await repo.findById(id);
  if (!existing) throw new ApiError(404, 'Rubric not found');
  const data = {};
  if (body.title !== undefined) data.title = body.title.trim();
  if (body.description !== undefined) data.description = body.description;
  if (body.status !== undefined) data.status = body.status;
  data.updated_at = new Date();
  await repo.update(id, data);
  const full = await repo.findById(id);
  return mapRubricDetail(full);
}

async function listCriteria(rubricId) {
  const rub = await repo.findById(rubricId);
  if (!rub) throw new ApiError(404, 'Rubric not found');
  const criteria = await repo.findCriteriaByRubric(rubricId);
  return { criteria: criteria.map(mapCriterion) };
}

async function assertCriterionNameUnique(rubricId, name, excludeId) {
  const list = await repo.findCriteriaByRubric(rubricId);
  const n = name.trim().toLowerCase();
  const clash = list.find((c) => c.criterion_name.trim().toLowerCase() === n && c.id !== excludeId);
  if (clash) throw new ApiError(400, 'Duplicate criterion name in this rubric');
}

async function createCriterion(rubricId, body) {
  const rub = await repo.findById(rubricId);
  if (!rub) throw new ApiError(404, 'Rubric not found');
  const w = Number(body.weight);
  if (!(w > 0) || w > 100) throw new ApiError(400, 'weight must be between 0 and 100 exclusive of 0');
  await assertCriterionNameUnique(rubricId, body.criterion_name);
  const sum = await repo.sumCriteriaWeights(rubricId);
  if (sum + w > 100.0001) throw new ApiError(400, 'Total criteria weights would exceed 100%');
  const c = await repo.createCriterion({
    rubric_id: rubricId,
    criterion_name: body.criterion_name.trim(),
    criterion_description: body.criterion_description ?? null,
    weight: body.weight,
  });
  return mapCriterion(c);
}

async function updateCriterion(id, body) {
  const existing = await repo.findCriterionById(id);
  if (!existing) throw new ApiError(404, 'Criterion not found');
  const rubricId = existing.rubric_id;
  const data = { updated_at: new Date() };
  if (body.criterion_name !== undefined) {
    data.criterion_name = body.criterion_name.trim();
    await assertCriterionNameUnique(rubricId, data.criterion_name, id);
  }
  if (body.criterion_description !== undefined) data.criterion_description = body.criterion_description;
  if (body.weight !== undefined) {
    const w = Number(body.weight);
    if (!(w > 0) || w > 100) throw new ApiError(400, 'weight must be between 0 and 100 exclusive of 0');
    const sum = await repo.sumCriteriaWeights(rubricId);
    const prev = Number(existing.weight);
    if (sum - prev + w > 100.0001) throw new ApiError(400, 'Total criteria weights would exceed 100%');
    data.weight = body.weight;
  }
  const c = await repo.updateCriterion(id, data);
  return mapCriterion(c);
}

async function deleteCriterion(id) {
  const existing = await repo.findCriterionById(id);
  if (!existing) throw new ApiError(404, 'Criterion not found');
  await repo.deleteCriterion(id);
  return { id };
}

module.exports = {
  listRubrics,
  getRubricById,
  createRubric,
  updateRubric,
  listCriteria,
  createCriterion,
  updateCriterion,
  deleteCriterion,
};

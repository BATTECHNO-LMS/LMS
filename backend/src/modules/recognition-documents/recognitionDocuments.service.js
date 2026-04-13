const { ApiError } = require('../../utils/apiError');
const requestsRepo = require('../recognition-requests/recognitionRequests.repository');
const repo = require('./recognitionDocuments.repository');
const recognitionRequestsService = require('../recognition-requests/recognitionRequests.service');

const PROTECTED_STATUSES = new Set(['submitted', 'under_review', 'approved', 'rejected']);

function assertDocumentsEditable(requestStatus) {
  if (PROTECTED_STATUSES.has(requestStatus)) {
    throw new ApiError(400, 'Recognition documents cannot be modified at this workflow stage');
  }
}

function mapDoc(d) {
  return {
    id: d.id,
    recognition_request_id: d.recognition_request_id,
    document_type: d.document_type,
    title: d.title,
    file_url: d.file_url,
    created_at: d.created_at,
    updated_at: d.updated_at,
  };
}

async function listForRequest(recognitionRequestId, requester) {
  await recognitionRequestsService.getRecognitionRequestById(recognitionRequestId, requester);
  const rows = await repo.findManyByRequest(recognitionRequestId);
  return { recognition_documents: rows.map(mapDoc) };
}

async function createForRequest(recognitionRequestId, body, requester) {
  const reqRow = await requestsRepo.findById(recognitionRequestId);
  if (!reqRow) throw new ApiError(404, 'Recognition request not found');
  const { recognition_request } = await recognitionRequestsService.getRecognitionRequestById(recognitionRequestId, requester);
  assertDocumentsEditable(reqRow.status);
  const created = await repo.create({
    recognition_request_id: recognitionRequestId,
    document_type: body.document_type,
    title: body.title,
    file_url: body.file_url,
  });
  return { recognition_document: mapDoc(created) };
}

async function getDocumentById(id, requester) {
  const row = await repo.findById(id);
  if (!row) throw new ApiError(404, 'Recognition document not found');
  await recognitionRequestsService.getRecognitionRequestById(row.recognition_request_id, requester);
  return { recognition_document: mapDoc(row) };
}

async function updateDocument(id, body, requester) {
  const row = await repo.findById(id);
  if (!row) throw new ApiError(404, 'Recognition document not found');
  const reqRow = await requestsRepo.findById(row.recognition_request_id);
  await recognitionRequestsService.getRecognitionRequestById(row.recognition_request_id, requester);
  assertDocumentsEditable(reqRow.status);
  const data = { updated_at: new Date() };
  if (body.document_type !== undefined) data.document_type = body.document_type;
  if (body.title !== undefined) data.title = body.title;
  if (body.file_url !== undefined) data.file_url = body.file_url;
  const updated = await repo.update(id, data);
  return { recognition_document: mapDoc(updated) };
}

async function deleteDocument(id, requester) {
  const row = await repo.findById(id);
  if (!row) throw new ApiError(404, 'Recognition document not found');
  const reqRow = await requestsRepo.findById(row.recognition_request_id);
  await recognitionRequestsService.getRecognitionRequestById(row.recognition_request_id, requester);
  assertDocumentsEditable(reqRow.status);
  await repo.remove(id);
  return { deleted: true };
}

module.exports = {
  listForRequest,
  createForRequest,
  getDocumentById,
  updateDocument,
  deleteDocument,
};

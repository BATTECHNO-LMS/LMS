export const recognitionKeys = {
  all: ['recognition-requests'],
  list: (params) => [...recognitionKeys.all, 'list', params],
  detail: (id) => [...recognitionKeys.all, 'detail', id],
  documents: (requestId) => [...recognitionKeys.all, 'documents', requestId],
  document: (id) => [...recognitionKeys.all, 'document', id],
};

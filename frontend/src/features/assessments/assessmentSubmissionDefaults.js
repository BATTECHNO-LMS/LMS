/** UI select values (i18n keys) ↔ API `submission_type` on assessments. */

const UI_TO_API = {
  file_upload: 'file',
  repo_link: 'repo_url',
  text_response: 'text_response',
};

const API_TO_UI = {
  file: 'file_upload',
  repo_url: 'repo_link',
  text_response: 'text_response',
  mixed: 'file_upload',
};

export function preferredSubmissionToApi(uiValue) {
  return UI_TO_API[uiValue] || 'file';
}

export function preferredSubmissionFromApi(apiValue) {
  if (!apiValue) return 'file_upload';
  return API_TO_UI[apiValue] || 'file_upload';
}

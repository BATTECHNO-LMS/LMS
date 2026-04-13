import { useQuery } from '@tanstack/react-query';
import { fetchSubmissionsList } from '../submissions.service.js';

export const submissionsKeys = {
  all: ['submissions'],
  list: (params) => [...submissionsKeys.all, 'list', params],
};

export function useSubmissions(params = {}, options = {}) {
  return useQuery({
    queryKey: submissionsKeys.list(params),
    queryFn: () => fetchSubmissionsList(params),
    ...options,
  });
}

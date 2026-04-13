import { useQuery } from '@tanstack/react-query';
import { fetchCorrectiveActionsList } from '../correctiveActions.service.js';

export const correctiveActionsKeys = {
  all: ['corrective-actions'],
  list: (params) => [...correctiveActionsKeys.all, 'list', params],
  detail: (id) => [...correctiveActionsKeys.all, 'detail', id],
};

/**
 * @param {Record<string, unknown>} [params]
 * @param {import('@tanstack/react-query').UseQueryOptions} [options]
 */
export function useCorrectiveActions(params = {}, options = {}) {
  return useQuery({
    queryKey: correctiveActionsKeys.list(params),
    queryFn: () => fetchCorrectiveActionsList(params),
    ...options,
  });
}

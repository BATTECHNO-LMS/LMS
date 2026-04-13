import { useQuery } from '@tanstack/react-query';
import { fetchCorrectiveActionById } from '../correctiveActions.service.js';
import { correctiveActionsKeys } from './useCorrectiveActions.js';

/**
 * @param {string|undefined} id
 * @param {import('@tanstack/react-query').UseQueryOptions} [options]
 */
export function useCorrectiveAction(id, options = {}) {
  return useQuery({
    queryKey: correctiveActionsKeys.detail(id),
    queryFn: () => fetchCorrectiveActionById(id),
    enabled: Boolean(id),
    ...options,
  });
}

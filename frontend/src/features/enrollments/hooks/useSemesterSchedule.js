import { useQuery } from '@tanstack/react-query';
import { fetchSemesterSchedule } from '../enrollments.service.js';

export const semesterScheduleKeys = {
  all: ['semesterSchedule'],
  mine: () => [...semesterScheduleKeys.all, 'mine'],
};

/**
 * @param {import('@tanstack/react-query').UseQueryOptions} [options]
 */
export function useSemesterSchedule(options = {}) {
  return useQuery({
    queryKey: semesterScheduleKeys.mine(),
    queryFn: () => fetchSemesterSchedule(),
    ...options,
  });
}

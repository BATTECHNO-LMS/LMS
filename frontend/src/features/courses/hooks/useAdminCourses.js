import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  archiveAdminCourse,
  createAdminCourse,
  fetchAdminCoursesList,
  publishAdminCourse,
  updateAdminCourse,
} from '../courses.service.js';
import { coursesKeys } from './coursesQueryKeys.js';

export function useAdminCourses(params = {}, options = {}) {
  return useQuery({
    queryKey: coursesKeys.adminList(params),
    queryFn: () => fetchAdminCoursesList(params),
    ...options,
  });
}

export function useCreateCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createAdminCourse,
    onSuccess: () => qc.invalidateQueries({ queryKey: coursesKeys.all }),
  });
}

export function useUpdateCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => updateAdminCourse(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: coursesKeys.all }),
  });
}

export function usePublishCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: publishAdminCourse,
    onSuccess: () => qc.invalidateQueries({ queryKey: coursesKeys.all }),
  });
}

export function useArchiveCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: archiveAdminCourse,
    onSuccess: () => qc.invalidateQueries({ queryKey: coursesKeys.all }),
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createCourseLesson,
  createCourseSection,
  deleteCourseLesson,
  deleteCourseSection,
  fetchCourseStructure,
  updateCourseLesson,
  updateCourseSection,
  reorderCourseLessons,
} from '../courses.service.js';
import { coursesKeys } from './coursesQueryKeys.js';

export function useCourseStructure(courseId, options = {}) {
  return useQuery({
    queryKey: coursesKeys.structure(courseId),
    queryFn: () => fetchCourseStructure(courseId),
    enabled: Boolean(courseId),
    ...options,
  });
}

export function useCourseStructureMutations(courseId) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: coursesKeys.structure(courseId) });

  return {
    createSection: useMutation({
      mutationFn: (body) => createCourseSection(courseId, body),
      onSuccess: invalidate,
    }),
    updateSection: useMutation({
      mutationFn: ({ sectionId, body }) => updateCourseSection(courseId, sectionId, body),
      onSuccess: invalidate,
    }),
    deleteSection: useMutation({
      mutationFn: (sectionId) => deleteCourseSection(courseId, sectionId),
      onSuccess: invalidate,
    }),
    createLesson: useMutation({
      mutationFn: ({ sectionId, body }) => createCourseLesson(courseId, sectionId, body),
      onSuccess: invalidate,
    }),
    updateLesson: useMutation({
      mutationFn: ({ lessonId, body }) => updateCourseLesson(courseId, lessonId, body),
      onSuccess: invalidate,
    }),
    deleteLesson: useMutation({
      mutationFn: (lessonId) => deleteCourseLesson(courseId, lessonId),
      onSuccess: invalidate,
    }),
    reorderLessons: useMutation({
      mutationFn: (items) => reorderCourseLessons(courseId, items),
      onSuccess: invalidate,
    }),
  };
}

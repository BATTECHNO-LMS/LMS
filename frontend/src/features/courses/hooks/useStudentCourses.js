import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  completeStudentLesson,
  fetchStudentCourse,
  fetchStudentCoursesList,
  startStudentCourse,
} from '../courses.service.js';
import { coursesKeys } from './coursesQueryKeys.js';

export function useStudentCourses(params = {}, options = {}) {
  return useQuery({
    queryKey: coursesKeys.studentList(params),
    queryFn: () => fetchStudentCoursesList(params),
    ...options,
  });
}

export function useStudentCourse(id, options = {}) {
  return useQuery({
    queryKey: coursesKeys.studentDetail(id),
    queryFn: () => fetchStudentCourse(id),
    enabled: Boolean(id),
    ...options,
  });
}

export function useStartStudentCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: startStudentCourse,
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: coursesKeys.studentList() });
      qc.invalidateQueries({ queryKey: coursesKeys.studentDetail(id) });
    },
  });
}

export function useCompleteLesson(courseId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lessonId) => completeStudentLesson(courseId, lessonId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: coursesKeys.studentDetail(courseId) });
      qc.invalidateQueries({ queryKey: coursesKeys.studentList() });
    },
  });
}

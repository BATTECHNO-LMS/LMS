export const coursesKeys = {
  all: ['courses'],
  adminList: (params) => [...coursesKeys.all, 'admin', 'list', params],
  adminDetail: (id) => [...coursesKeys.all, 'admin', 'detail', id],
  structure: (id) => [...coursesKeys.all, 'admin', 'structure', id],
  studentList: (params) => [...coursesKeys.all, 'student', 'list', params],
  studentDetail: (id) => [...coursesKeys.all, 'student', 'detail', id],
};

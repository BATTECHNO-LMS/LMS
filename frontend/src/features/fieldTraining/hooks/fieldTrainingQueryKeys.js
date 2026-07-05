export const fieldTrainingKeys = {
  all: ['fieldTraining'],
  adminList: (params = {}) => [...fieldTrainingKeys.all, 'admin', 'list', params],
  adminStats: (params = {}) => [...fieldTrainingKeys.all, 'admin', 'stats', params],
  adminDetail: (id) => [...fieldTrainingKeys.all, 'admin', 'detail', id],
  adminApplications: (id) => [...fieldTrainingKeys.all, 'admin', 'applications', id],
  studentList: (params = {}) => [...fieldTrainingKeys.all, 'student', 'list', params],
  studentDetail: (id) => [...fieldTrainingKeys.all, 'student', 'detail', id],
  myApplications: () => [...fieldTrainingKeys.all, 'student', 'myApplications'],
  tasks: (opportunityId, scope = 'admin') => [...fieldTrainingKeys.all, scope, 'tasks', opportunityId],
  submissions: (opportunityId) => [...fieldTrainingKeys.all, 'admin', 'submissions', opportunityId],
};

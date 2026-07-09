export const fieldTrainingKeys = {
  all: ['fieldTraining'],
  adminList: (params = {}) => [...fieldTrainingKeys.all, 'admin', 'list', params],
  adminStats: (params = {}) => [...fieldTrainingKeys.all, 'admin', 'stats', params],
  adminDetail: (id) => [...fieldTrainingKeys.all, 'admin', 'detail', id],
  adminApplications: (id, params = {}) => [...fieldTrainingKeys.all, 'admin', 'applications', id, params],
  studentList: (params = {}) => [...fieldTrainingKeys.all, 'student', 'list', params],
  studentDetail: (id) => [...fieldTrainingKeys.all, 'student', 'detail', id],
  studentProgress: (id) => [...fieldTrainingKeys.all, 'student', 'progress', id],
  studentSessions: (id) => [...fieldTrainingKeys.all, 'student', 'sessions', id],
  studentAssessments: (id) => [...fieldTrainingKeys.all, 'student', 'assessments', id],
  myApplications: () => [...fieldTrainingKeys.all, 'student', 'myApplications'],
  instructorList: (params = {}) => [...fieldTrainingKeys.all, 'instructor', 'list', params],
  instructorDetail: (id) => [...fieldTrainingKeys.all, 'instructor', 'detail', id],
  tasks: (opportunityId, scope = 'admin') => [...fieldTrainingKeys.all, scope, 'tasks', opportunityId],
  submissions: (opportunityId, scope = 'admin') =>
    [...fieldTrainingKeys.all, scope, 'submissions', opportunityId],
  sessions: (opportunityId, scope = 'admin') =>
    [...fieldTrainingKeys.all, scope, 'sessions', opportunityId],
  instructors: () => [...fieldTrainingKeys.all, 'instructors'],
  assessments: (opportunityId, scope = 'admin') =>
    [...fieldTrainingKeys.all, scope, 'assessments', opportunityId],
  sessionAttendance: (sessionId) => [...fieldTrainingKeys.all, 'attendance', sessionId],
  sessionParticipants: (sessionId) => [...fieldTrainingKeys.all, 'participants', sessionId],
  applicationProgress: (applicationId) => [...fieldTrainingKeys.all, 'progress', applicationId],
};

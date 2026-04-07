/** Placeholder rows for instructor/student assessment UIs until API wiring. */

export const INSTRUCTOR_ASSESSMENTS = [
  {
    id: '1',
    name: 'اختبار الوحدة الأولى',
    type: 'quiz',
    weight: 15,
    learningOutcome: 'مخرج 1 — فهم المفاهيم',
    openDate: '2026-04-01',
    closeDate: '2026-04-20',
    submissionsCount: 12,
    status: 'published',
    cohortName: 'دفعة ربيع 2026',
  },
  {
    id: '2',
    name: 'مشروع التطبيق العملي',
    type: 'capstone_project',
    weight: 40,
    learningOutcome: 'مخرج 3 — التطبيق',
    openDate: '2026-03-15',
    closeDate: '2026-06-01',
    submissionsCount: 5,
    status: 'draft',
    cohortName: 'دفعة ربيع 2026',
  },
];

export const STUDENT_ASSESSMENTS = [
  {
    id: '1',
    name: 'اختبار الوحدة الأولى',
    type: 'quiz',
    due: '2026-04-20',
    submissionState: 'open',
  },
  {
    id: '2',
    name: 'واجب التحليل',
    type: 'assignment',
    due: '2026-04-10',
    submissionState: 'submitted',
  },
  {
    id: '3',
    name: 'معمل البيانات',
    type: 'lab',
    due: '2026-03-01',
    submissionState: 'late',
  },
  {
    id: '4',
    name: 'عرض المشروع',
    type: 'presentation',
    due: '2026-05-30',
    submissionState: 'graded',
  },
];

export const STUDENT_SUBMISSION_ROWS = [
  {
    id: '1',
    assessmentName: 'واجب التحليل',
    type: 'assignment',
    submittedAt: '2026-04-08',
    state: 'submitted',
    score: '—',
  },
  {
    id: '2',
    assessmentName: 'معمل البيانات',
    type: 'lab',
    submittedAt: '—',
    state: 'late',
    score: '—',
  },
];

export const INSTRUCTOR_SUBMISSION_ROWS = [
  {
    id: '1',
    studentName: 'محمد علي',
    assessmentName: 'واجب التحليل',
    submittedAt: '2026-04-08 14:20',
    status: 'submitted',
    gradeStatus: 'pending',
  },
  {
    id: '2',
    studentName: 'سارة أحمد',
    assessmentName: 'واجب التحليل',
    submittedAt: '2026-04-09 09:05',
    status: 'submitted',
    gradeStatus: 'graded',
  },
];

export function getInstructorAssessmentById(id) {
  return INSTRUCTOR_ASSESSMENTS.find((x) => String(x.id) === String(id));
}

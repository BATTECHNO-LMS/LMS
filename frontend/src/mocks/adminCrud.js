/** In-memory demo records for CRUD UI — replace with API integration later. */

export const MOCK_USERS = [
  {
    id: '1',
    name: 'سارة أحمد',
    email: 'sarah@univ.edu',
    role: 'instructor',
    status: 'active',
    lastLogin: '2026-04-01',
  },
  {
    id: '2',
    name: 'محمد علي',
    email: 'mali@univ.edu',
    role: 'student',
    status: 'inactive',
    lastLogin: '—',
  },
];

export const MOCK_UNIVERSITIES = [
  {
    id: '1',
    name: 'جامعة المدينة',
    contact: 'مكتب الشراكات',
    email: 'contact@univ.edu',
    status: 'active',
    programs: 4,
  },
];

export const MOCK_TRACKS = [
  {
    id: '1',
    name: 'مسار تحليل البيانات',
    code: 'DS-101',
    level: 'متوسط',
    status: 'active',
    cohorts: 2,
  },
];

export const MOCK_MICRO_CREDENTIALS = [
  {
    id: '1',
    name: 'أساسيات الذكاء الاصطناعي',
    code: 'AI-X1',
    level: 'مبتدئ',
    hours: 40,
    status: 'approved',
    trackId: '1',
    cohorts: 1,
  },
];

export const MOCK_COHORTS = [
  {
    id: '1',
    name: 'دفعة ربيع 2026',
    credentialId: '1',
    credentialName: 'أساسيات الذكاء الاصطناعي',
    universityId: '1',
    universityName: 'جامعة المدينة',
    instructor: 'د. خالد',
    startDate: '2026-01-10',
    endDate: '2026-06-30',
    status: 'running',
  },
];

export const MOCK_ASSESSMENTS = [
  {
    id: '1',
    name: 'اختبار منتصف المدة',
    type: 'quiz',
    weight: 20,
    cohortId: '1',
    cohortName: 'دفعة ربيع 2026',
    dueDate: '2026-04-15',
    status: 'pending',
  },
];

export const MOCK_RECOGNITION = [
  {
    id: '1',
    title: 'طلب اعتماد برنامج',
    universityId: '1',
    universityName: 'جامعة المدينة',
    credentialName: 'أساسيات الذكاء الاصطناعي',
    cohortName: 'دفعة ربيع 2026',
    status: 'pending',
    createdAt: '2026-03-20',
  },
];

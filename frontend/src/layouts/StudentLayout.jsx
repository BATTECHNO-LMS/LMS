import { BaseDashboardLayout } from './BaseDashboardLayout.jsx';
import { StudentAttendanceWindowPopup } from '../components/fieldTraining/StudentAttendanceWindowPopup.jsx';
import { FieldTrainingTourHost } from '../components/help/FieldTrainingTourHost.jsx';
import { useAuth } from '../features/auth/index.js';

export function StudentLayout() {
  const { user } = useAuth();
  const isStudent = String(user?.role || '').toLowerCase() === 'student';
  return (
    <>
      <BaseDashboardLayout />
      {isStudent ? <StudentAttendanceWindowPopup /> : null}
      {isStudent ? <FieldTrainingTourHost /> : null}
    </>
  );
}

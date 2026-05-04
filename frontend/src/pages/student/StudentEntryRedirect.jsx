import { Navigate } from 'react-router-dom';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { useStudentEnrollments } from '../../features/enrollments/index.js';

/**
 * After login, students land on /student and are routed to programs or enrollment catalog.
 */
export function StudentEntryRedirect() {
  const { data, isLoading, isError } = useStudentEnrollments({ staleTime: 15_000 });

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const list = isError ? [] : (data?.enrollments ?? []);
  const hasApproved = list.some((e) => ['enrolled', 'completed'].includes(e.enrollment_status));

  if (hasApproved) {
    return <Navigate to="/student/programs" replace />;
  }

  return <Navigate to="/student/available-cohorts" replace />;
}

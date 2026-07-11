import { Navigate, useParams } from 'react-router-dom';

/** Deep-link wrappers that open the manage hub on a specific tab. */
export function InstructorFieldTrainingSessionsPage() {
  const { id } = useParams();
  return <Navigate to={`/instructor/field-training/${id}/manage?tab=sessions`} replace />;
}

export function InstructorFieldTrainingAttendancePage() {
  const { id } = useParams();
  return <Navigate to={`/instructor/field-training/${id}/manage?tab=attendance`} replace />;
}

export function InstructorFieldTrainingSubmissionsPage() {
  const { id } = useParams();
  return <Navigate to={`/instructor/field-training/${id}/tasks`} replace />;
}

export function InstructorFieldTrainingResultsPage() {
  const { id } = useParams();
  return <Navigate to={`/instructor/field-training/${id}/manage?tab=pre_assessment`} replace />;
}

export function InstructorFieldTrainingEligibilityPage() {
  const { id } = useParams();
  return <Navigate to={`/instructor/field-training/${id}/manage?tab=eligibility`} replace />;
}

import { Navigate, useParams } from 'react-router-dom';

/** Canonical progress URL redirects into the detail hub overview tab. */
export function StudentFieldTrainingProgressRedirect() {
  const { id } = useParams();
  if (!id) return <Navigate to="/student/field-training" replace />;
  return <Navigate to={`/student/field-training/${id}?tab=overview`} replace />;
}

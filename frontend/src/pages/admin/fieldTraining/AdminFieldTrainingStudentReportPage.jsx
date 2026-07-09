import { useParams } from 'react-router-dom';
import { FieldTrainingStudentReportPage } from '../../shared/fieldTrainingReports/FieldTrainingStudentReportPage.jsx';

export function AdminFieldTrainingStudentReportPage() {
  const { applicationId } = useParams();
  return (
    <FieldTrainingStudentReportPage
      basePath="/admin/field-training/reports"
      applicationId={applicationId}
      mode="admin"
    />
  );
}

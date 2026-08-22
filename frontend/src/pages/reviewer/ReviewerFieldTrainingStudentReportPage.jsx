import { useParams } from 'react-router-dom';
import { FieldTrainingStudentReportPage } from '../shared/fieldTrainingReports/FieldTrainingStudentReportPage.jsx';

export function ReviewerFieldTrainingStudentReportPage() {
  const { applicationId } = useParams();
  return (
    <FieldTrainingStudentReportPage
      basePath="/reviewer/field-training/reports"
      applicationId={applicationId}
      mode="reviewer"
    />
  );
}

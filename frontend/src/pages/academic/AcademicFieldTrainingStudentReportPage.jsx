import { useParams } from 'react-router-dom';
import { FieldTrainingStudentReportPage } from '../shared/fieldTrainingReports/FieldTrainingStudentReportPage.jsx';

export function AcademicFieldTrainingStudentReportPage() {
  const { applicationId } = useParams();
  return (
    <FieldTrainingStudentReportPage
      basePath="/academic/field-training/reports"
      applicationId={applicationId}
      mode="academic"
    />
  );
}

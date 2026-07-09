import { FieldTrainingApplicationsReportPage } from '../shared/fieldTrainingReports/FieldTrainingApplicationsReportPage.jsx';

export function AcademicFieldTrainingStudentsPage() {
  return (
    <FieldTrainingApplicationsReportPage
      basePath="/academic/field-training/reports"
      mode="academic"
    />
  );
}

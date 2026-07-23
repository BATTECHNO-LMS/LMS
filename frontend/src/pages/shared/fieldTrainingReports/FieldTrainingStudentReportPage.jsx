import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileDown, FileSpreadsheet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { DataTable } from '../../../components/tables/DataTable.jsx';
import { UnauthorizedPage } from '../../../components/permissions/UnauthorizedPage.jsx';
import { useTenant } from '../../../features/tenant/index.js';
import {
  exportFieldTrainingStudentReport,
  useFieldTrainingStudentReport,
} from '../../../features/fieldTrainingReports/index.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import { formatFtDate } from '../../../features/fieldTraining/fieldTrainingUi.js';

function DetailGrid({ items }) {
  return (
    <dl className="ft-report-detail-grid">
      {items.map(([label, value]) => (
        <div key={label} className="ft-report-detail-grid__item">
          <dt>{label}</dt>
          <dd>{value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function FieldTrainingStudentReportPage({ basePath, applicationId, mode = 'admin' }) {
  const { t } = useTranslation('fieldTrainingReports');
  const { t: tCommon } = useTranslation('common');
  const [exporting, setExporting] = useState(null);

  const { data, isLoading, isError, error } = useFieldTrainingStudentReport(applicationId, {
    staleTime: 30_000,
    mode,
  });

  const attendance = data?.attendance_summary ?? {};
  const letter = data?.completion_letter ?? {};

  async function handleExport(format) {
    setExporting(format);
    try {
      await exportFieldTrainingStudentReport(applicationId, format, mode);
    } finally {
      setExporting(null);
    }
  }

  const studentItems = useMemo(
    () =>
      data
        ? [
            [t('student.name'), data.student?.full_name],
            [t('student.email'), data.student?.email],
            [t('student.phone'), data.student?.phone],
            [t('student.university'), data.student?.university?.name],
            [t('student.universitySpecialty'), data.student?.university_specialty_label],
            [t('student.canonicalSpecialty'), data.student?.canonical_specialty_label],
            [t('student.accountStatus'), data.student?.account_status],
          ]
        : [],
    [data, t]
  );

  return (
    <div className="page page--field-training-reports">
      <AdminPageHeader
        title={t('studentReport.title')}
        description={data?.student?.full_name ?? t('studentReport.description')}
        actions={
          <div className="ft-report-hub__actions">
            <Link className="btn btn--ghost btn--sm" to={basePath}>
              {t('common.backToHub')}
            </Link>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              disabled={exporting === 'pdf'}
              onClick={() => handleExport('pdf')}
            >
              <FileDown size={16} aria-hidden />
              {t('export.pdf')}
            </button>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              disabled={exporting === 'xlsx'}
              onClick={() => handleExport('xlsx')}
            >
              <FileSpreadsheet size={16} aria-hidden />
              {t('export.excel')}
            </button>
          </div>
        }
      />

      {isLoading ? <LoadingSpinner /> : null}
      {isError && error?.response?.status === 403 ? (
        <UnauthorizedPage title={t('global.forbiddenTitle')} description={t('global.forbiddenDescription')} />
      ) : null}
      {isError && error?.response?.status !== 403 ? (
        <p className="crud-muted">{getApiErrorMessage(error, tCommon('errors.generic'))}</p>
      ) : null}

      {data && !isLoading ? (
        <>
          <SectionCard title={t('sections.student')}>
            <DetailGrid items={studentItems} />
          </SectionCard>

          <SectionCard title={t('sections.opportunity')}>
            <DetailGrid
              items={[
                [t('opportunity.title'), data.opportunity?.title],
                [t('opportunity.track'), data.opportunity?.training_track?.name_ar ?? data.opportunity?.training_track?.name_en],
                [t('opportunity.instructor'), data.opportunity?.assigned_instructor?.full_name],
                [t('opportunity.dates'), `${formatFtDate(data.opportunity?.start_date)} — ${formatFtDate(data.opportunity?.end_date)}`],
                [t('opportunity.mode'), data.opportunity?.training_mode],
                [t('opportunity.location'), data.opportunity?.location],
              ]}
            />
          </SectionCard>

          <SectionCard title={t('sections.application')}>
            <DetailGrid
              items={[
                [t('application.submittedAt'), formatFtDate(data.application?.created_at)],
                [t('application.status'), data.application?.status],
                [t('application.trainingStatus'), data.application?.training_status],
                [t('application.adminNote'), data.application?.admin_note],
                [t('application.expulsionReason'), data.application?.expulsion_reason],
              ]}
            />
          </SectionCard>

          <SectionCard title={t('sections.preAssessment')}>
            <DetailGrid
              items={[
                [t('assessment.score'), data.pre_assessment?.score],
                [t('assessment.level'), data.pre_assessment?.level],
                [t('assessment.submittedAt'), formatFtDate(data.pre_assessment?.submitted_at)],
              ]}
            />
          </SectionCard>

          <SectionCard title={t('sections.attendance')}>
            <DetailGrid
              items={[
                [t('attendance.totalSessions'), attendance.total_sessions],
                [t('attendance.present'), attendance.present],
                [t('attendance.absent'), attendance.absent],
                [t('attendance.late'), attendance.late],
                [t('attendance.excused'), attendance.excused],
                [t('attendance.percentage'), attendance.attendance_percentage != null ? `${attendance.attendance_percentage}%` : '—'],
                [t('attendance.eligibility'), attendance.attendance_eligibility == null ? '—' : attendance.attendance_eligibility ? t('common.yes') : t('common.no')],
              ]}
            />
            <DataTable
              columns={[
                { key: 'title', label: t('table.session') },
                { key: 'session_date', label: t('table.date') },
                { key: 'attendance_status', label: t('table.attendanceStatus') },
                { key: 'attendance_note', label: t('table.notes') },
              ]}
              rows={(data.sessions ?? []).map((session) => ({
                id: session.id,
                title: session.title,
                session_date: `${session.session_date ?? ''} ${session.start_time ?? ''}`.trim(),
                attendance_status: session.attendance?.status ?? '—',
                attendance_note: session.attendance?.note ?? '',
              }))}
            />
          </SectionCard>

          <SectionCard title={t('sections.hours')}>
            <DetailGrid
              items={[
                [t('hours.required'), data.training_hours?.required_training_hours],
                [t('hours.completed'), data.training_hours?.completed_training_hours],
                [t('hours.remaining'), data.training_hours?.remaining_training_hours],
                [
                  t('hours.percentage'),
                  data.training_hours?.hours_completion_percentage != null
                    ? `${data.training_hours.hours_completion_percentage}%`
                    : '—',
                ],
                [t('hours.status'), data.training_hours?.hours_completion_status ?? '—'],
              ]}
            />
          </SectionCard>

          <SectionCard title={t('sections.tasks')}>
            <DataTable
              columns={[
                { key: 'task_title', label: t('table.task') },
                { key: 'due_date', label: t('table.dueDate') },
                { key: 'is_final_task', label: t('table.finalTask') },
                { key: 'has_instruction_file', label: t('table.instructionFile') },
                { key: 'instruction_file_name', label: t('table.instructionFileName') },
                { key: 'has_solution_file', label: t('table.solutionFile') },
                { key: 'solution_file_name', label: t('table.solutionFileName') },
                { key: 'has_ai_self_evaluation', label: t('table.aiSelfEval') },
                { key: 'review_status', label: t('table.reviewStatus') },
                { key: 'submitted_at', label: t('table.submittedAt') },
                { key: 'is_late', label: t('table.late') },
                { key: 'student_self_evaluation_input', label: t('table.aiStudentInput') },
                { key: 'project_url', label: t('table.projectUrl') },
                { key: 'file_extraction_status', label: t('table.fileExtraction') },
                { key: 'url_extraction_status', label: t('table.urlExtraction') },
                { key: 'ai_prompt_used', label: t('table.aiPromptUsed') },
                { key: 'ai_response_inserted_text', label: t('table.aiResponse') },
                { key: 'final_student_notes', label: t('table.finalNotes') },
                { key: 'instructor_feedback', label: t('table.instructorFeedback') },
              ]}
              rows={(data.submissions ?? []).map((sub) => ({
                ...sub,
                is_final_task: sub.is_final_task ? t('common.yes') : t('common.no'),
                has_instruction_file: sub.has_instruction_file ? t('common.yes') : t('common.no'),
                has_solution_file: sub.has_solution_file ? t('common.yes') : t('common.no'),
                has_ai_self_evaluation: sub.has_ai_self_evaluation || sub.student_self_evaluation_input
                  ? t('common.yes')
                  : t('common.no'),
                is_late: sub.is_late ? t('common.yes') : t('common.no'),
                submitted_at: formatFtDate(sub.submitted_at),
                student_self_evaluation_input: sub.student_self_evaluation_input || '—',
                project_url: sub.project_url || '—',
                file_extraction_status: sub.file_extraction_status || '—',
                url_extraction_status: sub.url_extraction_status || '—',
                ai_prompt_used: sub.ai_prompt_used || '—',
                ai_response_inserted_text: sub.ai_response_inserted_text || '—',
                final_student_notes: sub.final_student_notes || '—',
                instructor_feedback: sub.instructor_feedback || '—',
                instruction_file_name: sub.instruction_file_name || '—',
                solution_file_name: sub.solution_file_name || '—',
              }))}
            />
          </SectionCard>

          <SectionCard title={t('sections.postAssessment')}>
            <DetailGrid
              items={[
                [t('assessment.score'), data.post_assessment?.score],
                [t('assessment.passed'), data.post_assessment?.passed == null ? '—' : data.post_assessment?.passed ? t('common.yes') : t('common.no')],
                [t('assessment.submittedAt'), formatFtDate(data.post_assessment?.submitted_at)],
              ]}
            />
          </SectionCard>

          <SectionCard title={t('sections.eligibility')}>
            <DetailGrid
              items={[
                [t('eligibility.status'), data.completion_eligibility?.status],
                [t('eligibility.attendanceRule'), data.completion_eligibility?.attendance_rule],
                [t('eligibility.hoursRule'), data.completion_eligibility?.hours_rule],
                [t('eligibility.taskRule'), data.completion_eligibility?.task_rule],
                [t('eligibility.postAssessmentRule'), data.completion_eligibility?.post_assessment_rule],
              ]}
            />
          </SectionCard>

          <SectionCard title={t('sections.completionLetter')}>
            <DetailGrid
              items={[
                [t('letter.issued'), letter.issued ? t('common.yes') : t('common.no')],
                [t('letter.number'), letter.letter_no],
                [t('letter.issuedAt'), formatFtDate(letter.issued_at)],
                [t('letter.verificationCode'), letter.verification_code],
              ]}
            />
            {letter.pdf_url ? (
              <p>
                <a href={letter.pdf_url} target="_blank" rel="noopener noreferrer" className="btn btn--outline btn--sm">
                  {t('letter.download')}
                </a>
              </p>
            ) : null}
          </SectionCard>

          <SectionCard title={t('sections.timeline')}>
            {(data.timeline ?? []).length === 0 ? (
              <p className="crud-muted">{t('timeline.empty')}</p>
            ) : (
              <ol className="ft-report-timeline">
                {(data.timeline ?? []).map((event, index) => (
                  <li key={`${event.key}-${index}`} className="ft-report-timeline__item">
                    <div className="ft-report-timeline__marker" aria-hidden />
                    <div className="ft-report-timeline__body">
                      <time className="ft-report-timeline__date">{formatFtDate(event.at)}</time>
                      <p className="ft-report-timeline__label">{event.label_ar || event.key}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}

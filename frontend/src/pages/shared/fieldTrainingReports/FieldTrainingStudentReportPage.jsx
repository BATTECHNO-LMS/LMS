import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileDown, FileSpreadsheet, Printer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { DataTable } from '../../../components/tables/DataTable.jsx';
import { UnauthorizedPage } from '../../../components/permissions/UnauthorizedPage.jsx';
import {
  exportFieldTrainingStudentReport,
  useFieldTrainingStudentReport,
} from '../../../features/fieldTrainingReports/index.js';
import { FieldTrainingReportRoleBanner } from './FieldTrainingReportRoleBanner.jsx';
import { getReportPaths, mergeReportCapabilities } from './reportCapabilities.js';
import { useAuth } from '../../../features/auth/index.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import { formatFtDate } from '../../../features/fieldTraining/fieldTrainingUi.js';

function DetailGrid({ items }) {
  return (
    <dl className="ft-report-detail-grid">
      {items.map(([label, value]) => (
        <div key={label} className="ft-report-detail-grid__item">
          <dt>{label}</dt>
          <dd>{value ?? 'â€”'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function FieldTrainingStudentReportPage({ basePath, applicationId, mode = 'admin' }) {
  const { t } = useTranslation('fieldTrainingReports');
  const { t: tCommon } = useTranslation('common');
  const { user } = useAuth();
  const [exporting, setExporting] = useState(null);
  const [exportError, setExportError] = useState(null);
  const [tab, setTab] = useState('summary');
  const paths = getReportPaths(basePath, mode);

  const { data, isLoading, isError, error } = useFieldTrainingStudentReport(applicationId, {
    staleTime: 30_000,
    mode,
  });
  const capabilities = mergeReportCapabilities(data?.capabilities, user, mode);

  const attendance = data?.attendance_summary ?? {};
  const letter = data?.completion_letter ?? {};

  async function handleExport(format) {
    if (exporting) return;
    setExporting(format);
    setExportError(null);
    try {
      await exportFieldTrainingStudentReport(applicationId, format, mode);
    } catch (err) {
      setExportError(err);
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
            <Link className="btn btn--ghost btn--sm" to={paths.hub}>
              {t('common.backToHub')}
            </Link>
            {capabilities.canExportPdf ? (
              <button
                type="button"
                className="btn btn--outline btn--sm"
                disabled={Boolean(exporting)}
                onClick={() => handleExport('pdf')}
              >
                <FileDown size={16} aria-hidden />
                {exporting === 'pdf' ? t('export.generating') : t('export.pdf')}
              </button>
            ) : null}
            {capabilities.canExportExcel ? (
              <button
                type="button"
                className="btn btn--outline btn--sm"
                disabled={Boolean(exporting)}
                onClick={() => handleExport('xlsx')}
              >
                <FileSpreadsheet size={16} aria-hidden />
                {exporting === 'xlsx' ? t('export.generating') : t('export.excel')}
              </button>
            ) : null}
            {capabilities.canPrint ? (
              <button type="button" className="btn btn--outline btn--sm" onClick={() => window.print()}>
                <Printer size={16} aria-hidden />
                {t('export.print')}
              </button>
            ) : null}
          </div>
        }
      />

      <FieldTrainingReportRoleBanner user={user} mode={mode} capabilities={capabilities} />

      {exportError ? (
        <p className="crud-muted" role="alert">
          {getApiErrorMessage(exportError, tCommon('errors.generic'))}
        </p>
      ) : null}

      {isLoading ? <LoadingSpinner /> : null}
      {isError && error?.response?.status === 403 ? (
        <UnauthorizedPage title={t('global.forbiddenTitle')} description={t('global.forbiddenDescription')} />
      ) : null}
      {isError && error?.response?.status !== 403 ? (
        <p className="crud-muted">{getApiErrorMessage(error, tCommon('errors.generic'))}</p>
      ) : null}

      {data && !isLoading ? (
        <>
          {exporting ? <p className="ft-report-generating" role="status">{t('export.generating')}</p> : null}
          <div className="ft-report-kpi-row">
            {[
              [t('metrics.progress'), data.executive_summary?.overall_progress != null ? `${data.executive_summary.overall_progress}%` : t('common.unavailable')],
              [t('attendance.percentage'), data.executive_summary?.attendance_percentage != null ? `${data.executive_summary.attendance_percentage}%` : t('common.unavailable')],
              [t('hours.completed'), data.executive_summary?.completed_hours ?? t('common.unavailable')],
              [t('hours.required'), data.executive_summary?.required_hours ?? t('common.unavailable')],
              [t('table.taskProgress'), data.executive_summary?.task_progress?.display ?? t('common.unavailable')],
              [t('student.trainingStatus'), data.executive_summary?.training_status_label ?? data.application?.training_status],
              [t('letter.issued'), data.executive_summary?.certificate_status_label],
            ].map(([label, value]) => (
              <div key={label} className="ft-report-mini-kpi">
                <span>{label}</span>
                <strong>{value ?? 'â€”'}</strong>
              </div>
            ))}
          </div>
          <nav className="ft-report-tabs" aria-label={t('studentReport.tabsLabel')}>
            {['summary', 'attendance', 'hours', 'tasks', 'assessments', 'progress', 'completion', 'certificate'].map((key) => (
              <button
                key={key}
                type="button"
                className={`ft-report-tabs__btn${tab === key ? ' is-active' : ''}`}
                onClick={() => setTab(key)}
              >
                {t(`studentReport.tabs.${key}`)}
              </button>
            ))}
          </nav>
          <div className={`ft-report-tab-panel${tab === 'summary' ? ' is-active' : ''}`}>
          <SectionCard title={t('sections.student')}>
            <DetailGrid items={studentItems} />
          </SectionCard>

          <SectionCard title={t('sections.opportunity')}>
            <DetailGrid
              items={[
                [t('opportunity.title'), data.opportunity?.title],
                [t('opportunity.track'), data.opportunity?.training_track?.name_ar ?? data.opportunity?.training_track?.name_en],
                [t('opportunity.instructor'), data.opportunity?.assigned_instructor?.full_name],
                [t('opportunity.dates'), `${formatFtDate(data.opportunity?.start_date)} â€” ${formatFtDate(data.opportunity?.end_date)}`],
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
                [t('table.taskProgress'), data.application?.task_progress?.display ?? data.executive_summary?.task_progress?.display],
                [t('application.adminNote'), data.application?.admin_note],
                [t('application.expulsionReason'), data.application?.expulsion_reason],
              ]}
            />
          </SectionCard>
          </div>

          <div className={`ft-report-tab-panel${tab === 'assessments' ? ' is-active' : ''}`}>
          <SectionCard title={t('sections.preAssessment')}>
            <DetailGrid
              items={[
                [t('assessment.score'), data.pre_assessment?.score],
                [t('assessment.level'), data.pre_assessment?.level],
                [t('assessment.submittedAt'), formatFtDate(data.pre_assessment?.submitted_at)],
              ]}
            />
          </SectionCard>
          <SectionCard title={t('sections.postAssessment')}>
            <DetailGrid
              items={[
                [t('assessment.score'), data.post_assessment?.score],
                [t('assessment.passed'), data.post_assessment?.passed == null ? 'â€”' : data.post_assessment?.passed ? t('common.yes') : t('common.no')],
                [t('assessment.submittedAt'), formatFtDate(data.post_assessment?.submitted_at)],
                [t('assessment.delta'), data.learning_improvement?.difference_pp],
              ]}
            />
          </SectionCard>
          </div>

          <div className={`ft-report-tab-panel${tab === 'attendance' ? ' is-active' : ''}`}>
          <SectionCard title={t('sections.attendance')}>
            <DetailGrid
              items={[
                [t('attendance.totalSessions'), attendance.total_sessions],
                [t('attendance.present'), attendance.present],
                [t('attendance.absent'), attendance.absent],
                [t('attendance.late'), attendance.late],
                [t('attendance.excused'), attendance.excused],
                [t('attendance.unconfirmed'), attendance.unconfirmed],
                [t('attendance.percentage'), attendance.attendance_percentage != null ? `${attendance.attendance_percentage}%` : t('common.unavailable')],
                [t('attendance.eligibility'), attendance.attendance_eligibility == null ? t('common.unavailable') : attendance.attendance_eligibility ? t('common.yes') : t('common.no')],
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
                attendance_status: session.attendance?.status ?? 'â€”',
                attendance_note: session.attendance?.note ?? '',
              }))}
            />
          </SectionCard>
          </div>

          <div className={`ft-report-tab-panel${tab === 'hours' ? ' is-active' : ''}`}>
          <SectionCard title={t('sections.hours')}>
            <DetailGrid
              items={[
                [t('hours.required'), data.training_hours?.required_training_hours ?? t('common.unavailable')],
                [t('hours.scheduled'), data.training_hours?.scheduled_training_hours ?? t('common.unavailable')],
                [t('hours.completed'), data.training_hours?.completed_training_hours ?? t('common.unavailable')],
                [t('hours.remaining'), data.training_hours?.remaining_training_hours ?? t('common.unavailable')],
                [
                  t('hours.percentage'),
                  data.training_hours?.hours_completion_percentage != null
                    ? `${data.training_hours.hours_completion_percentage}%`
                    : t('common.unavailable'),
                ],
                [t('hours.status'), data.training_hours?.hours_completion_status_label ?? data.training_hours?.hours_completion_status ?? t('common.unavailable')],
              ]}
            />
          </SectionCard>
          </div>

          <div className={`ft-report-tab-panel${tab === 'tasks' ? ' is-active' : ''}`}>
          <SectionCard title={t('sections.tasks')}>
            {data.tasks_required === false && !(data.submissions || []).length ? (
              <p className="crud-muted">{t('common.notRequired')}</p>
            ) : (
            <DataTable
              columns={[
                { key: 'task_title', label: t('table.task') },
                { key: 'due_date', label: t('table.dueDate') },
                { key: 'submitted_at', label: t('table.submittedAt') },
                { key: 'is_late', label: t('table.late') },
                { key: 'review_status', label: t('table.reviewStatus') },
                { key: 'instructor_feedback', label: t('table.instructorFeedback') },
                ...(mode === 'student'
                  ? []
                  : [
                      { key: 'has_ai_self_evaluation', label: t('table.aiSelfEval') },
                      { key: 'ai_prompt_used', label: t('table.aiPromptUsed') },
                      { key: 'ai_response_inserted_text', label: t('table.aiResponse') },
                    ]),
              ]}
              rows={(data.submissions ?? []).map((sub) => ({
                ...sub,
                is_late: sub.is_late ? t('common.yes') : t('common.no'),
                submitted_at: formatFtDate(sub.submitted_at),
                instructor_feedback: sub.instructor_feedback || 'â€”',
                has_ai_self_evaluation: sub.has_ai_self_evaluation || sub.student_self_evaluation_input
                  ? t('common.yes')
                  : t('common.no'),
                ai_prompt_used: sub.ai_prompt_used || 'â€”',
                ai_response_inserted_text: sub.ai_response_inserted_text || 'â€”',
              }))}
            />
            )}
          </SectionCard>
          </div>

          <div className={`ft-report-tab-panel${tab === 'progress' ? ' is-active' : ''}`}>
          <SectionCard title={t('sections.requirements')}>
            <ul className="checklist">
              {(data.requirements || []).map((req) => (
                <li key={req.key}>
                  <span>{req.label}</span>
                  <strong>{req.label_ar}</strong>
                </li>
              ))}
            </ul>
          </SectionCard>
          <SectionCard title={t('sections.eligibility')}>
            <DetailGrid
              items={[
                [t('eligibility.status'), data.completion_eligibility?.status_label ?? data.completion_eligibility?.status],
                [t('eligibility.attendanceRule'), data.completion_eligibility?.attendance_rule == null ? t('common.unavailable') : data.completion_eligibility.attendance_rule ? t('common.yes') : t('common.no')],
                [t('eligibility.hoursRule'), data.completion_eligibility?.hours_rule == null ? t('common.unavailable') : data.completion_eligibility.hours_rule ? t('common.yes') : t('common.no')],
                [t('eligibility.taskRule'), data.completion_eligibility?.task_rule == null ? t('common.notRequired') : data.completion_eligibility.task_rule ? t('common.yes') : t('common.no')],
                [t('eligibility.postAssessmentRule'), data.completion_eligibility?.post_assessment_rule == null ? t('common.notRequired') : data.completion_eligibility.post_assessment_rule ? t('common.yes') : t('common.no')],
              ]}
            />
          </SectionCard>
          <SectionCard title={t('sections.recommendations')}>
            {(data.recommendations || []).length ? (
              <ul>
                {data.recommendations.map((row) => (
                  <li key={row.key}>{row.text}</li>
                ))}
              </ul>
            ) : (
              <p className="crud-muted">{t('common.unavailable')}</p>
            )}
          </SectionCard>
          </div>

          <div className={`ft-report-tab-panel${tab === 'completion' ? ' is-active' : ''}`}>
          <SectionCard title={t('sections.eligibility')}>
            <DetailGrid
              items={[
                [t('student.trainingStatus'), data.completion_decision?.final_status_label ?? data.application?.training_status],
                [t('eligibility.status'), data.completion_decision?.eligibility],
                [t('letter.issuedAt'), formatFtDate(data.completion_decision?.completion_date)],
                [t('eligibility.missing'), (data.completion_decision?.missing_requirements || []).join('ØŒ ') || t('common.unavailable')],
              ]}
            />
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
          </div>

          <div className={`ft-report-tab-panel${tab === 'certificate' ? ' is-active' : ''}`}>
          <SectionCard title={t('sections.completionLetter')}>
            <DetailGrid
              items={[
                [t('letter.issued'), letter.issued ? t('common.yes') : letter.status_label || t('common.no')],
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
          </div>
        </>
      ) : null}
    </div>
  );
}

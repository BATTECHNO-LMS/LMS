import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { LoadingSpinner } from '../../../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../../../components/common/EmptyState.jsx';
import { getApiErrorMessage } from '../../../../services/apiHelpers.js';
import {
  fetchStudentPortfolio,
  downloadStudentPortfolioPdf,
} from '../../../../features/fieldTraining/fieldTraining.service.js';
import { fieldTrainingKeys } from '../../../../features/fieldTraining/hooks/fieldTrainingQueryKeys.js';

export function StudentPortfolioTab({ opportunityId, enabled = true }) {
  const { t } = useTranslation('fieldTraining');
  const query = useQuery({
    queryKey: fieldTrainingKeys.studentPortfolio(opportunityId),
    queryFn: () => fetchStudentPortfolio(opportunityId),
    enabled: Boolean(opportunityId) && enabled,
    staleTime: 30_000,
  });

  if (query.isLoading) return <LoadingSpinner />;
  if (query.isError) {
    return (
      <EmptyState
        title={t('portfolio.loadError')}
        description={getApiErrorMessage(query.error, t('loadError'))}
      />
    );
  }

  const portfolio = query.data;
  const summary = portfolio?.summary || {};
  const sections = portfolio?.sections || [];

  return (
    <div className="ft-portfolio">
      <header className="ft-portfolio__hero">
        <div>
          <p className="ft-portfolio__eyebrow">{t('portfolio.eyebrow')}</p>
          <h2 className="ft-portfolio__title">{t('portfolio.title')}</h2>
          <p className="ft-portfolio__lead">{t('portfolio.lead')}</p>
        </div>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => downloadStudentPortfolioPdf(opportunityId)}
        >
          {t('portfolio.exportPdf')}
        </button>
      </header>

      <div className="ft-portfolio__kpis">
        <div>
          <strong>{summary.evidence_count || 0}</strong>
          <span>{t('portfolio.kpi.evidence')}</span>
        </div>
        <div>
          <strong>{summary.tasks || 0}</strong>
          <span>{t('portfolio.kpi.tasks')}</span>
        </div>
        <div>
          <strong>{summary.logbook_approved || 0}</strong>
          <span>{t('portfolio.kpi.logbook')}</span>
        </div>
        <div>
          <strong>{summary.sections_with_evidence || 0}</strong>
          <span>{t('portfolio.kpi.sections')}</span>
        </div>
      </div>

      <p className="ft-portfolio__score-note">{t('portfolio.noScoreNote')}</p>

      {!sections.length ? (
        <EmptyState title={t('portfolio.emptyTitle')} description={t('portfolio.emptyDesc')} />
      ) : (
        <div className="ft-portfolio__sections">
          {sections.map((section) => (
            <details key={section.key} className="ft-portfolio__section" open={section.key === 'overview' || section.key === 'progress'}>
              <summary>{section.title_ar}</summary>
              <ul>
                {section.items.map((item, idx) => (
                  <li key={`${section.key}-${idx}`}>
                    {section.key === 'logbook' ? (
                      <>
                        <strong>{String(item.entry_date).slice(0, 10)}</strong> — {item.activity}
                        <em> · {t('portfolio.verified')}</em>
                      </>
                    ) : section.key === 'tasks' ? (
                      <>
                        {item.title} — {item.submitted ? t('portfolio.submitted') : t('portfolio.notSubmitted')}
                        {item.verification ? ` (${item.verification})` : ''}
                      </>
                    ) : section.key === 'skills' ? (
                      item.skill
                    ) : section.key === 'recorded_lectures' ? (
                      <>
                        {item.title} —{' '}
                        {item.completed_at
                          ? t('portfolio.completed')
                          : `${Math.round(item.progress_percent || 0)}%`}
                      </>
                    ) : section.key === 'attendance_hours' ? (
                      <>
                        {t('portfolio.attendance')}: {item.attendance_percentage ?? '—'}% ·{' '}
                        {t('portfolio.hours')}: {item.hours_completed ?? 0} / {item.hours_required ?? '—'}{' '}
                        {t('portfolio.hoursUnit')}
                      </>
                    ) : section.key === 'student_uploads' ? (
                      <>
                        {item.title} <em>({t('portfolio.studentAdded')})</em>
                      </>
                    ) : section.key === 'progress' ? (
                      <>
                        {t('portfolio.score')}: {item.final_score ?? '—'} / 100
                        <br />
                        <small>{item.note_ar}</small>
                      </>
                    ) : section.key === 'assessments' ? (
                      <>
                        {String(item.type || '').toUpperCase()}:{' '}
                        {item.completed ? t('portfolio.completed') : t('portfolio.incomplete')}
                        {item.type === 'pre' ? ` (${t('portfolio.preNotScored')})` : ''}
                      </>
                    ) : section.key === 'completion' ? (
                      <>
                        {t('portfolio.letterNo')}: {item.letter_no}
                      </>
                    ) : section.key === 'overview' ? (
                      <>
                        {item.student_name} · {item.opportunity_title}
                      </>
                    ) : (
                      JSON.stringify(item).slice(0, 140)
                    )}
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

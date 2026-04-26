import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

/**
 * @param {{ grades: object[] }} props
 */
export function StudentGradeList({ grades }) {
  const { t } = useTranslation('dashboard');

  if (!grades.length) {
    return <p className="crud-muted">{t('student.dashboard.empty.grades')}</p>;
  }

  return (
    <div className="student-grade-list">
      {grades.map((g) => (
        <div key={g.id} className="student-grade-list__row">
          <div>
            <div style={{ fontWeight: 700, color: 'var(--color-heading)' }}>{g.assessment?.title ?? '—'}</div>
            <div className="student-dash__mini-meta">
              {g.is_final ? <span className="status-badge status-badge--approved">{t('student.dashboard.badges.final')}</span> : null}
            </div>
          </div>
          <div style={{ textAlign: 'end' }}>
            <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{g.score != null ? String(g.score) : '—'}</div>
            <div className="student-dash__mini-meta">
              {g.feedback ? t('student.dashboard.gradeRow.hasFeedback') : t('student.dashboard.gradeRow.noFeedback')}
            </div>
          </div>
        </div>
      ))}
      <div style={{ marginTop: '0.5rem' }}>
        <Link to="/student/grades" className="btn btn--outline btn--sm">
          {t('student.dashboard.actions.viewGrades')}
        </Link>
      </div>
    </div>
  );
}

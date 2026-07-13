import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { StudentEmptyState } from './StudentEmptyState.jsx';
import { StudentStatusBadge } from './StudentStatusBadge.jsx';

/**
 * @param {{ grades: object[] }} props
 */
export function StudentGradeList({ grades }) {
  const { t } = useTranslation('dashboard');

  if (!grades.length) {
    return <StudentEmptyState title={t('student.dashboard.empty.grades')} />;
  }

  return (
    <div className="student-grade-list">
      {grades.map((g) => {
        const max = Number(g.assessment?.max_score) || 100;
        const score = g.score != null ? Number(g.score) : null;
        const pct = score != null && max > 0 ? Math.round((score / max) * 100) : null;
        const passed = pct != null ? pct >= 50 : null;
        return (
          <div key={g.id} className="student-grade-list__row student-dash__session-card">
            <div>
              <div className="student-dash__row-title">{g.assessment?.title ?? '—'}</div>
              <div className="student-dash__mini-meta">
                {g.is_final ? (
                  <StudentStatusBadge variant="success">
                    {t('student.dashboard.badges.final')}
                  </StudentStatusBadge>
                ) : null}
                {g.graded_at || g.updated_at ? (
                  <span>
                    {' '}
                    {new Date(g.graded_at || g.updated_at).toLocaleDateString()}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="student-grade-list__score">
              <div className="student-grade-list__score-value">
                {score != null ? String(score) : '0'}
                {pct != null ? <span className="student-grade-list__pct"> ({pct}%)</span> : null}
              </div>
              {passed != null ? (
                <StudentStatusBadge variant={passed ? 'success' : 'danger'}>
                  {passed
                    ? t('student.dashboard.gradeRow.pass', { defaultValue: 'ناجح' })
                    : t('student.dashboard.gradeRow.fail', { defaultValue: 'راسب' })}
                </StudentStatusBadge>
              ) : null}
            </div>
          </div>
        );
      })}
      <div className="student-grade-list__footer">
        <Link to="/student/grades" className="btn btn--outline btn--sm">
          {t('student.dashboard.actions.viewGrades')}
        </Link>
      </div>
    </div>
  );
}

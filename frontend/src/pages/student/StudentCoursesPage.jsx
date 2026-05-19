import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Clock, GraduationCap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar.jsx';
import { SearchInput } from '../../components/admin/SearchInput.jsx';
import { SelectField } from '../../components/admin/SelectField.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { COURSE_LEVELS, useStudentCourses } from '../../features/courses/index.js';
import { PagePermissionGate } from '../../components/permissions/PagePermissionGate.jsx';
import { UI_PERMISSION } from '../../constants/permissions.js';

export function StudentCoursesPage() {
  const { t } = useTranslation('courses');
  const { t: tCommon } = useTranslation('common');
  const [q, setQ] = useState('');
  const [level, setLevel] = useState('');
  const params = useMemo(() => {
    const p = {};
    if (level) p.level = level;
    const s = q.trim();
    if (s) p.search = s;
    return p;
  }, [q, level]);
  const { data, isLoading, isError } = useStudentCourses(params);
  const courses = data?.courses ?? [];

  return (
    <PagePermissionGate permission={UI_PERMISSION.canViewCourses}>
      <div className="page page--dashboard page--student">
        <AdminPageHeader title={<>{t('student.title')}</>} description={<>{t('student.description')}</>} />
        <AdminFilterBar>
          <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('student.searchPlaceholder')} />
          <SelectField id="st-lvl" label={t('form.level')} value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="">—</option>
            {COURSE_LEVELS.map((l) => <option key={l.value} value={l.value}>{t(l.labelKey)}</option>)}
          </SelectField>
        </AdminFilterBar>
        {isLoading ? <LoadingSpinner /> : null}
        {isError ? <p className="crud-muted" role="alert">{tCommon('errors.generic')}</p> : null}
        <div className="course-cards-grid">
          {courses.map((c) => (
            <article key={c.id} className="course-card">
              <div className="course-card__cover">
                {c.cover_image_url ? <img src={c.cover_image_url} alt="" /> : <BookOpen size={40} aria-hidden />}
              </div>
              <div className="course-card__body">
                <h3 className="course-card__title">{c.title}</h3>
                <p className="course-card__desc">{c.short_description || '—'}</p>
                <p className="course-card__meta">
                  <GraduationCap size={14} />{' '}
                  {t(COURSE_LEVELS.find((l) => l.value === c.level)?.labelKey ?? 'levels.beginner')}
                  <Clock size={14} style={{ marginInlineStart: '0.75rem' }} />
                  {c.estimated_duration_minutes ? `${c.estimated_duration_minutes} ${t('student.minutes')}` : '—'}
                </p>
                {c.progress_percent > 0 ? (
                  <p className="course-card__progress">{t('student.progress')}: {c.progress_percent}%</p>
                ) : null}
                <Link to={`/student/courses/${c.id}`} className="btn btn--primary btn--sm">
                  {c.progress_percent > 0 ? t('student.continue') : t('student.start')}
                </Link>
              </div>
            </article>
          ))}
        </div>
        {!isLoading && !isError && !courses.length ? <p className="crud-muted">{t('student.noCourses')}</p> : null}
      </div>
    </PagePermissionGate>
  );
}

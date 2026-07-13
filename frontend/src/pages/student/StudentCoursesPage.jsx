import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen } from 'lucide-react';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar.jsx';
import { SearchInput } from '../../components/admin/SearchInput.jsx';
import { SelectField } from '../../components/admin/SelectField.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { COURSE_LEVELS, useStudentCourses } from '../../features/courses/index.js';
import { PagePermissionGate } from '../../components/permissions/PagePermissionGate.jsx';
import { UI_PERMISSION } from '../../constants/permissions.js';
import {
  StudentPageHeader,
  StudentCourseCard,
  StudentEmptyState,
} from '../../components/student/index.js';

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
        <StudentPageHeader title={t('student.title')} description={t('student.description')} />
        <AdminFilterBar>
          <SearchInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('student.searchPlaceholder')}
          />
          <SelectField
            id="st-lvl"
            label={t('form.level')}
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          >
            <option value="">—</option>
            {COURSE_LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {t(l.labelKey)}
              </option>
            ))}
          </SelectField>
        </AdminFilterBar>
        {isLoading ? <LoadingSpinner /> : null}
        {isError ? (
          <p className="student-section-error" role="alert">
            {tCommon('errors.generic')}
          </p>
        ) : null}
        {!isLoading && !isError && !courses.length ? (
          <StudentEmptyState title={t('student.noCourses')} icon={BookOpen} />
        ) : null}
        {!isError && courses.length ? (
          <div className="student-portal-cards student-portal-cards--courses">
            {courses.map((c) => (
              <StudentCourseCard key={c.id} course={c} />
            ))}
          </div>
        ) : null}
      </div>
    </PagePermissionGate>
  );
}

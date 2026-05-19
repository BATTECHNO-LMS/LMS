import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/index.js';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { useCourseStructure } from '../../../features/courses/index.js';
import { CourseStructurePanel } from './components/CourseStructurePanel.jsx';

export function AdminCourseLessonsPage() {
  const { id: courseId } = useParams();
  const { t } = useTranslation('courses');
  const { data, isLoading, isError, refetch } = useCourseStructure(courseId);

  if (isLoading) return <LoadingSpinner />;

  if (isError || !data?.course) {
    return (
      <div className="page page--dashboard page--admin">
        <Link className="btn btn--ghost btn--sm" to="/admin/courses" style={{ marginBottom: '1rem' }}>
          <ArrowLeft size={16} /> {t('structure.backToCourses')}
        </Link>
        <p className="crud-muted" role="alert">{t('structure.loadFailed')}</p>
        <Button type="button" variant="outline" onClick={() => refetch()}>{t('structure.retry')}</Button>
      </div>
    );
  }

  return (
    <div className="page page--dashboard page--admin course-structure-page">
      <div className="course-structure-toolbar">
        <Link className="btn btn--ghost btn--sm" to="/admin/courses">
          <ArrowLeft size={16} /> {t('structure.backToCourses')}
        </Link>
      </div>

      <AdminPageHeader
        title={data.course.title}
        description={<>{t('structure.pageDescription')}</>}
      />

      <CourseStructurePanel courseId={courseId} />
    </div>
  );
}

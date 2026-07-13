import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookOpen, User } from 'lucide-react';
import { CourseCoverImage } from '../courses/CourseCoverImage.jsx';
import { StudentProgressBar } from './StudentProgressBar.jsx';

/**
 * Enrolled course card — dashboard and courses list.
 */
export function StudentCourseCard({ course }) {
  const { t } = useTranslation('dashboard');
  const progress = Math.min(100, Math.max(0, Number(course.progress_percent) || 0));
  const total = Number(course.lessons_count) || 0;
  const done = Number(course.completed_lessons_count) || 0;
  const started = Boolean(course.enrollment_status) && progress > 0;
  const to = `/student/courses/${course.id}`;
  const instructor =
    course.instructor?.full_name ||
    course.instructor_name ||
    course.created_by?.full_name ||
    null;

  return (
    <article className="student-course-card">
      <div className="student-course-card__cover">
        <CourseCoverImage src={course.cover_image_url} iconSize={32} />
      </div>
      <div className="student-course-card__body">
        <h3 className="student-course-card__title">{course.title}</h3>
        {instructor ? (
          <p className="student-course-card__instructor">
            <User size={14} aria-hidden />
            <span>{instructor}</span>
          </p>
        ) : null}
        {(course.category || course.level) && (
          <p className="student-course-card__meta">
            <BookOpen size={14} aria-hidden />
            {[course.category, course.level].filter(Boolean).join(' · ')}
          </p>
        )}
        <p className="student-course-card__lessons">
          {t('student.dashboard.courses.lessonsProgress', { done, total })}
        </p>
        <StudentProgressBar value={progress} className="student-course-card__progress" />
        <div className="student-course-card__footer">
          <span className="student-course-card__pct">{progress}%</span>
          <Link to={to} className="btn btn--primary btn--sm">
            {started
              ? t('student.dashboard.courses.continue')
              : t('student.dashboard.courses.start')}
          </Link>
        </div>
      </div>
    </article>
  );
}

/** @deprecated Use StudentCourseCard */
export const StudentCourseDashCard = StudentCourseCard;

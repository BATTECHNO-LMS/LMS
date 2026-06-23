import heroStudentLearning from '../../../assets/landing/illustrations/hero-student-learning.svg';
import heroInstructorSessions from '../../../assets/landing/illustrations/hero-instructor-sessions.svg';
import heroCertificate from '../../../assets/landing/illustrations/hero-certificate.svg';

/**
 * Curated hero SVGs — decorative column on the start side only (max 3).
 * @type {ReadonlyArray<{ id: string, src: string, position: 'top' | 'mid' | 'bottom' }>}
 */
export const HERO_SIDE_ILLUSTRATIONS = [
  {
    id: 'student',
    src: heroStudentLearning,
    position: 'top',
  },
  {
    id: 'certificate',
    src: heroCertificate,
    position: 'mid',
  },
  {
    id: 'instructor',
    src: heroInstructorSessions,
    position: 'bottom',
  },
];

import { AdminPageHeader } from '../admin/AdminPageHeader.jsx';
import { cn } from '../../utils/helpers.js';

/**
 * Student portal page header — same visual system as Admin.
 */
export function StudentPageHeader({ className, ...props }) {
  return <AdminPageHeader className={cn('student-page-header', className)} {...props} />;
}

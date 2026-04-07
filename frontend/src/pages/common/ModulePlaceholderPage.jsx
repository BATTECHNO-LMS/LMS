import { Navigate, useLocation } from 'react-router-dom';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { useAuth } from '../../features/auth/index.js';
import { canAccessPath, getPageTitleForPath } from '../../constants/navigation.js';
import { getDashboardPathForRole } from '../../utils/helpers.js';

/**
 * Fallback for module routes until feature pages exist.
 */
export function ModulePlaceholderPage() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!canAccessPath(user.role, location.pathname)) {
    return <Navigate to={getDashboardPathForRole(user.role)} replace />;
  }

  const title = getPageTitleForPath(user.role, location.pathname);

  return (
    <div className="page page--dashboard">
      <PageHeader title={title} subtitle="هذه الصفحة جاهزة هيكلياً وستُربط بالواجهة الخلفية لاحقاً." />
      <EmptyState
        title="لا يوجد محتوى بعد"
        description="سيتم عرض بيانات الوحدة هنا بعد التكامل مع الخادم."
      />
    </div>
  );
}

import { Link } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import { useAuth } from '../../features/auth/index.js';
import { getDashboardPathForRole } from '../../utils/helpers.js';

export function UnauthorizedPage() {
  const { user } = useAuth();
  const home = getDashboardPathForRole(user?.role);

  return (
    <div className="page page--unauthorized">
      <div className="unauthorized-card">
        <div className="unauthorized-card__icon" aria-hidden>
          <ShieldOff size={40} strokeWidth={1.75} />
        </div>
        <h1 className="unauthorized-card__title">غير مصرح لك بالوصول إلى هذه الصفحة</h1>
        <p className="unauthorized-card__desc">
          لا تملك الصلاحيات الكافية لعرض هذا المحتوى ضمن واجهة النظام. إذا كان يجب أن يكون لديك وصول، تواصل مع الإدارة.
        </p>
        <Link className="btn btn--primary" to={home}>
          العودة للوحة الرئيسية
        </Link>
      </div>
    </div>
  );
}

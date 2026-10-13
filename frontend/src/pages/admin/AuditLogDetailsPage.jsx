import { Link, useParams } from 'react-router-dom';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { AuditEventDetails } from '../../components/activity/AuditEventDetails.jsx';
import { useAuditLog } from '../../features/auditLogs/hooks/useAuditLog.js';
import { useAuth } from '../../features/auth/index.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';

export function AuditLogDetailsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const superAdmin = Boolean(user?.isGlobal || user?.role === 'super_admin');
  const { data, isLoading, isError, error } = useAuditLog(id, { staleTime: 30_000 });
  const row = data?.audit_log;

  if (isLoading) {
    return (
      <div className="page page--admin crud-page">
        <p className="crud-muted">جارٍ التحميل…</p>
      </div>
    );
  }

  if (isError || !row) {
    return (
      <div className="page page--admin crud-page">
        <AdminPageHeader title="تعذر عرض الحدث" description={getApiErrorMessage(error, '')} />
        <Link className="btn btn--primary" to="/admin/audit-logs">
          العودة إلى سجل النشاط
        </Link>
      </div>
    );
  }

  return (
    <div className="page page--dashboard page--admin crud-page activity-log">
      <AdminPageHeader title="تفاصيل الحدث" description="عرض كامل لحدث من سجل النشاط." />
      <SectionCard>
        <AuditEventDetails row={row} showTechnical={superAdmin} />
        <div className="crud-view-actions">
          <Link className="btn btn--outline" to="/admin/audit-logs">
            العودة إلى سجل النشاط
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}

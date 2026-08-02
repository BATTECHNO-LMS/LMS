import { useAuth } from '../../features/auth/index.js';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { getRoleLabelAr } from '../../utils/authRouting.js';

export function TrainerProfilePage() {
  const { user } = useAuth();

  return (
    <div className="page page--dashboard" dir="rtl">
      <AdminPageHeader title="الملف الشخصي" description="بيانات حساب المدرب في بوابة المؤسسات." />
      <SectionCard title="البيانات الأساسية">
        <dl className="detail-list">
          <div className="detail-list__row">
            <dt>الاسم</dt>
            <dd>{user?.full_name || user?.fullName || '—'}</dd>
          </div>
          <div className="detail-list__row">
            <dt>البريد</dt>
            <dd dir="ltr">{user?.email || '—'}</dd>
          </div>
          <div className="detail-list__row">
            <dt>الهاتف</dt>
            <dd dir="ltr">{user?.phone || '—'}</dd>
          </div>
          <div className="detail-list__row">
            <dt>المؤسسة</dt>
            <dd>{user?.organization?.name || '—'}</dd>
          </div>
          <div className="detail-list__row">
            <dt>الدور</dt>
            <dd>{getRoleLabelAr('trainer', 'INSTITUTION')}</dd>
          </div>
        </dl>
      </SectionCard>
    </div>
  );
}

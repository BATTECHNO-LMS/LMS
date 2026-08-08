import { useLocation, useNavigate } from 'react-router-dom';
import { Clock3, Mail, ShieldCheck } from 'lucide-react';
import { Button } from '../../components/common/Button.jsx';
import { IllustratedStatusLayout } from '../../components/designSystem/index.js';

export function AccountStatusPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const details = location.state?.details || null;
  const overdue48h = Boolean(details?.overdue48h);

  const statusDetails = [
    {
      key: 'email',
      icon: <Mail size={16} aria-hidden />,
      label: 'البريد الإلكتروني',
      value: details?.maskedEmail || 'غير متاح',
    },
    {
      key: 'emailVerified',
      icon: <ShieldCheck size={16} aria-hidden />,
      label: 'حالة البريد',
      value: details?.emailVerified ? 'موثق' : 'غير موثق',
      badge: details?.emailVerified ? 'موثق' : 'بانتظار',
    },
    {
      key: 'accountStatus',
      icon: <Clock3 size={16} aria-hidden />,
      label: 'حالة الحساب',
      value:
        details?.accountStatus === 'inactive'
          ? 'بانتظار التفعيل'
          : details?.accountStatus || 'غير متاح',
    },
    {
      key: 'eta',
      icon: <Clock3 size={16} aria-hidden />,
      label: 'المدة المتوقعة',
      value: 'خلال 48 ساعة',
    },
  ];

  return (
    <div className="auth-page auth-page--split auth-page--login">
      <div className="auth-split-wrap illustrated-status-page">
        <IllustratedStatusLayout
          statusType={overdue48h ? 'warning' : 'pending'}
          title={overdue48h ? 'تأخر تفعيل الحساب' : 'حالة حسابك'}
          description={
            overdue48h
              ? 'مرّت أكثر من 48 ساعة على طلب التفعيل. يمكنك تحديث الحالة أو التواصل مع الدعم.'
              : 'يمكنك متابعة حالة التفعيل من هذه الصفحة.'
          }
          details={statusDetails}
          infoMessage={
            overdue48h
              ? 'مرّت أكثر من 48 ساعة على طلب التفعيل. يمكنك التواصل مع الدعم.'
              : 'عادةً ما يتم تفعيل الحساب خلال 48 ساعة من إتمام التسجيل.'
          }
          secondaryAction={
            <Button type="button" variant="outline" onClick={() => navigate('/portals')}>
              العودة إلى البوابات
            </Button>
          }
          primaryAction={
            <Button type="button" onClick={() => navigate('/student/user-guide/support')}>
              التواصل مع الدعم
            </Button>
          }
        />
      </div>
    </div>
  );
}

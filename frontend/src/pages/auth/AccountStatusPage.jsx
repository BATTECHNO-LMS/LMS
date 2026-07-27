import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../components/common/Button.jsx';
import { BrandLogo } from '../../components/common/BrandLogo.jsx';

export function AccountStatusPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const details = location.state?.details || null;

  return (
    <div className="auth-page auth-page--split auth-page--login">
      <div className="auth-split-wrap">
        <div className="auth-split">
          <section className="auth-split__form">
            <div className="auth-split__form-inner">
              <BrandLogo variant="auth" className="auth-split__logo" />
              <header className="auth-split__header">
                <h1 className="auth-split__title">حالة حسابك</h1>
                <p className="auth-split__subtitle">
                  يمكنك متابعة حالة التفعيل من هذه الصفحة.
                </p>
              </header>

              <div className="auth-form">
                <p className="auth-register__helper">
                  البريد الإلكتروني: {details?.maskedEmail || 'غير متاح'}
                </p>
                <p className="auth-register__helper">
                  حالة البريد: {details?.emailVerified ? 'موثق' : 'غير موثق'}
                </p>
                <p className="auth-register__helper">
                  حالة الحساب: {details?.accountStatus === 'inactive' ? 'بانتظار التفعيل' : details?.accountStatus || 'غير متاح'}
                </p>
                <p className="auth-register__helper">المدة المتوقعة: خلال 48 ساعة</p>
                {details?.overdue48h ? (
                  <p className="auth-form__error">
                    مرّت أكثر من 48 ساعة على طلب التفعيل. يمكنك التواصل مع الدعم.
                  </p>
                ) : null}
                <div className="auth-form__actions">
                  <Button type="button" variant="outline" onClick={() => navigate('/login/student')}>
                    تحديث الحالة
                  </Button>
                  <Button type="button" onClick={() => navigate('/student/user-guide/support')}>
                    التواصل مع الدعم
                  </Button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}


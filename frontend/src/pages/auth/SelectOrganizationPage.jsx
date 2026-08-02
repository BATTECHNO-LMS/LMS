import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Building2, GraduationCap } from 'lucide-react';
import { BrandLogo } from '../../components/common/BrandLogo.jsx';
import { Button } from '../../components/common/Button.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { useAuth } from '../../features/auth/index.js';
import { PORTAL_TYPES } from '../../constants/portalConfig.js';
import { getRoleLabelAr } from '../../utils/authRouting.js';
import { getRememberedPortal } from '../../utils/portal.js';
import { resolveAuthenticatedLandingRoute } from '../../utils/resolveAuthenticatedLandingRoute.js';
import { AuthBackgroundDecor } from './AuthBackgroundDecor.jsx';

export function SelectOrganizationPage() {
  const { user, isAuthenticated, isAuthReady, setActiveOrganization } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [submittingId, setSubmittingId] = useState(null);

  useEffect(() => {
    if (!isAuthReady || !isAuthenticated || !user) return;
    const resolution = resolveAuthenticatedLandingRoute(user);
    if (resolution.kind !== 'select_organization') {
      navigate(resolution.path, { replace: true });
    }
  }, [isAuthReady, isAuthenticated, user, navigate]);

  if (!isAuthReady) return <LoadingSpinner />;
  if (!isAuthenticated || !user) {
    return <Navigate to="/portals" replace />;
  }

  const rememberedPortal = getRememberedPortal();
  const assignments = (Array.isArray(user.organizationAssignments)
    ? user.organizationAssignments.filter((a) => a && a.isActive !== false)
    : []
  ).filter((a) => !rememberedPortal || a.organizationType === rememberedPortal);

  async function handleSelect(organizationId) {
    setError('');
    setSubmittingId(organizationId);
    try {
      const nextUser = await setActiveOrganization(organizationId);
      const resolution = resolveAuthenticatedLandingRoute(nextUser || user);
      navigate(resolution.path, { replace: true });
    } catch (err) {
      setError(err?.response?.data?.message || 'تعذر تفعيل الجهة المحددة. تأكد من أن الارتباط نشط.');
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <div className="auth-page auth-page--split auth-page--login" dir="rtl">
      <AuthBackgroundDecor />
      <div className="auth-split-wrap">
        <section className="auth-split__form" style={{ maxWidth: 720, margin: '0 auto', width: '100%' }}>
          <div className="auth-split__form-inner">
            <BrandLogo variant="auth" alt="BATTECHNO LMS" className="auth-split__logo" />
            <header className="auth-split__header">
              <h1 className="auth-split__title">اختر الجهة</h1>
              <p className="auth-split__subtitle">
                حسابك مرتبط بأكثر من جهة. اختر الجهة التي تريد الدخول إليها الآن.
              </p>
            </header>

            {error ? <p className="auth-form__error">{error}</p> : null}

            <ul className="portal-selection__grid" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {assignments.map((assignment) => {
                const isInstitution = assignment.organizationType === PORTAL_TYPES.INSTITUTION;
                const Icon = isInstitution ? Building2 : GraduationCap;
                const typeLabel = isInstitution ? 'مؤسسة' : 'جامعة';
                const roleLabel = getRoleLabelAr(assignment.roleCode, assignment.organizationType);
                return (
                  <li key={assignment.organizationId || assignment.id} className="portal-card">
                    <div className="portal-card__icon" aria-hidden>
                      {assignment.organizationLogoUrl ? (
                        <img
                          src={assignment.organizationLogoUrl}
                          alt=""
                          width={40}
                          height={40}
                          style={{ borderRadius: 8, objectFit: 'cover' }}
                        />
                      ) : (
                        <Icon size={28} />
                      )}
                    </div>
                    <h2 className="portal-card__title">{assignment.organizationName || 'جهة بدون اسم'}</h2>
                    <p className="portal-card__desc">
                      النوع: {typeLabel}
                      <br />
                      الدور: {roleLabel}
                      {assignment.branchName ? (
                        <>
                          <br />
                          الفرع: {assignment.branchName}
                        </>
                      ) : null}
                      {assignment.departmentName ? (
                        <>
                          <br />
                          القسم: {assignment.departmentName}
                        </>
                      ) : null}
                    </p>
                    <Button
                      type="button"
                      variant="primary"
                      disabled={Boolean(submittingId)}
                      onClick={() => handleSelect(assignment.organizationId)}
                    >
                      {submittingId === assignment.organizationId
                        ? 'جاري الدخول...'
                        : 'الدخول إلى هذه الجهة'}
                    </Button>
                  </li>
                );
              })}
            </ul>

            {!assignments.length ? (
              <p className="auth-form__error" role="status">
                لا يوجد ارتباط نشط بين حسابك وأي جامعة أو مؤسسة. يرجى التواصل مع الإدارة.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}

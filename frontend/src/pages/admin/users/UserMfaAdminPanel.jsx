import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, ShieldAlert, ShieldOff } from 'lucide-react';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { AppModal } from '../../../components/designSystem/AppModal.jsx';
import { FormTextarea } from '../../../components/forms/index.js';
import { fetchUserMfaStatus, resetUserMfa } from '../../../features/auth/mfa/mfaApi.js';
import { mfaErrorMessage } from '../../../features/auth/mfa/mfaPolicy.js';
import { formatDate } from '../../../utils/locale.js';

const REASON_MIN = 10;
const REASON_MAX = 500;

/**
 * Administrative MFA view for one user. The server enforces hierarchy and scope
 * (403 when out of reach) and requires a fresh step-up for the reset itself.
 */
export function UserMfaAdminPanel({ userId, canReset }) {
  const qc = useQueryClient();
  const key = ['users', userId, 'mfa'];
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const statusQuery = useQuery({ queryKey: key, queryFn: () => fetchUserMfaStatus(userId), retry: false });

  const reset = useMutation({
    mutationFn: () => resetUserMfa(userId, reason.trim()),
    onSuccess: (data) => {
      setOpen(false);
      setReason('');
      setNotice(
        `تمت إعادة تعيين المصادقة الثنائية وإنهاء ${data?.sessionsEnded ?? 0} من جلسات المستخدم.` +
          (data?.reEnrollmentRequired ? ' سيُطلب منه إعداد المصادقة الثنائية عند تسجيل الدخول التالي.' : '')
      );
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ['users', userId] });
    },
    onError: (err) => setError(mfaErrorMessage(err)),
  });

  const status = statusQuery.data;
  const reasonLength = reason.trim().length;
  const reasonValid = reasonLength >= REASON_MIN && reasonLength <= REASON_MAX;

  return (
    <SectionCard title="المصادقة الثنائية" className="security-card">
      {statusQuery.isLoading ? (
        <LoadingSpinner />
      ) : statusQuery.isError ? (
        <p className="crud-muted">{mfaErrorMessage(statusQuery.error)}</p>
      ) : (
        <div className="mfa-status">
          <div className={`mfa-status__badge ${status.enabled ? 'is-on' : 'is-off'}`}>
            {status.enabled ? <ShieldCheck size={22} aria-hidden /> : <ShieldAlert size={22} aria-hidden />}
            <div>
              <p className="mfa-status__title">{status.enabled ? 'مفعّلة' : 'غير مفعّلة'}</p>
              <p className="mfa-status__meta">
                {status.enabled
                  ? `منذ ${formatDate(status.enabledAt, 'ar', { dateStyle: 'medium' })} · رموز الاسترداد المتبقية: ${status.recoveryCodesRemaining}`
                  : status.required
                    ? 'سيُطلب من المستخدم إعدادها عند تسجيل الدخول.'
                    : 'اختيارية لهذا الدور.'}
              </p>
            </div>
            {status.required ? <StatusBadge variant="warning">إلزامية</StatusBadge> : null}
          </div>

          {notice ? (
            <p className="security-page__notice" role="status">
              {notice}
            </p>
          ) : null}

          {canReset && status.enabled ? (
            <div className="mfa-status__actions">
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => {
                  setError('');
                  setOpen(true);
                }}
              >
                <ShieldOff size={16} aria-hidden /> إعادة تعيين المصادقة الثنائية
              </Button>
            </div>
          ) : null}
        </div>
      )}

      <AppModal
        open={open}
        onClose={() => setOpen(false)}
        title="إعادة تعيين المصادقة الثنائية"
        description="سيتم تعطيل تطبيق المصادقة وإلغاء رموز الاسترداد وإنهاء جميع جلسات المستخدم فورًا. يُسجَّل هذا الإجراء في سجل الأمان."
        variant="danger"
        size="md"
        dismissible={!reset.isPending}
        closeOnOverlay={false}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={reset.isPending}>
              إلغاء
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={reset.isPending}
              disabled={reset.isPending || !reasonValid}
              onClick={() => {
                setError('');
                reset.mutate();
              }}
            >
              إعادة التعيين
            </Button>
          </>
        }
      >
        <FormTextarea
          id="mfa-reset-reason"
          label="سبب إعادة التعيين (إلزامي)"
          rows={3}
          maxLength={REASON_MAX}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="مثال: فقد المستخدم هاتفه وتم التحقق من هويته عبر قناة رسمية."
          error={error || (reasonLength > 0 && reasonLength < REASON_MIN ? `اكتب ${REASON_MIN} أحرف على الأقل.` : '')}
          autoFocus
        />
      </AppModal>
    </SectionCard>
  );
}

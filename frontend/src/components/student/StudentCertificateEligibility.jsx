import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * @param {{
 *   attendancePct: number | null,
 *   pendingSubmissionCount: number,
 *   recognitionStatus: string | null,
 *   hasIssuedCertificate: boolean,
 *   attendanceThreshold?: number,
 * }} props
 */
export function StudentCertificateEligibility({
  attendancePct,
  pendingSubmissionCount,
  recognitionStatus,
  hasIssuedCertificate,
  attendanceThreshold = 75,
}) {
  const { t } = useTranslation('dashboard');

  const attendanceOk = attendancePct != null && attendancePct >= attendanceThreshold;
  const submissionsOk = pendingSubmissionCount === 0;
  const rec = String(recognitionStatus || '').toLowerCase();
  const recognitionEligible = rec === 'eligible';
  const recognitionPending = rec === 'under_review' || rec === 'unknown' || rec === '';

  const state = useMemo(() => {
    if (hasIssuedCertificate) return 'issued';
    if (attendanceOk && submissionsOk && recognitionEligible) return 'eligible';
    if (attendanceOk && submissionsOk && recognitionPending) return 'pending';
    return 'notEligible';
  }, [hasIssuedCertificate, attendanceOk, submissionsOk, recognitionEligible, recognitionPending]);

  const reasonKey = useMemo(() => {
    if (hasIssuedCertificate) return null;
    if (!attendanceOk) return 'student.dashboard.certificate.reason.lowAttendance';
    if (!submissionsOk) return 'student.dashboard.certificate.reason.pendingSubmissions';
    if (!recognitionEligible && !recognitionPending) return 'student.dashboard.certificate.reason.recognitionBlocked';
    return 'student.dashboard.certificate.reason.none';
  }, [hasIssuedCertificate, attendanceOk, submissionsOk, recognitionEligible, recognitionPending]);

  const stateLabelKey = `student.dashboard.certificate.state.${state === 'notEligible' ? 'notEligible' : state}`;

  return (
    <div className="student-cert-check">
      <div className="student-cert-check__state">{t(stateLabelKey)}</div>
      <div className="student-cert-check__row">
        <span aria-hidden>{attendanceOk ? '✓' : '○'}</span>
        <span>{t('student.dashboard.certificate.attendance', { pct: attendanceThreshold })}</span>
      </div>
      <div className="student-cert-check__row">
        <span aria-hidden>{submissionsOk ? '✓' : '○'}</span>
        <span>{t('student.dashboard.certificate.submissions')}</span>
      </div>
      <div className="student-cert-check__row">
        <span aria-hidden>{recognitionEligible ? '✓' : '○'}</span>
        <span>{t('student.dashboard.certificate.recognition', { status: recognitionStatus ?? t('student.dashboard.certificate.state.unknown') })}</span>
      </div>
      <div className="student-cert-check__row">
        <span aria-hidden>{hasIssuedCertificate ? '✓' : '○'}</span>
        <span>{t('student.dashboard.certificate.issued')}</span>
      </div>
      {reasonKey ? <p className="student-cert-check__reason">{t(reasonKey, { pct: attendanceThreshold })}</p> : null}
    </div>
  );
}

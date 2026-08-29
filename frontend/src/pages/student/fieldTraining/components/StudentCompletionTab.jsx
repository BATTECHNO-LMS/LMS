import { useState } from 'react';
import { Award, Download, Eye } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../../components/common/Button.jsx';
import { StatusBadge } from '../../../../components/admin/StatusBadge.jsx';
import {
  downloadCompletionLetter,
  previewCompletionLetter,
  saveCompletionLetterBlob,
} from '../../../../features/fieldTraining/index.js';
import { getApiErrorMessage } from '../../../../services/apiHelpers.js';

export function StudentCompletionTab({
  applicationId,
  progress,
  application,
  enabled,
}) {
  const { t } = useTranslation('fieldTraining');
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const metrics = progress?.metrics ?? {};
  const eligibility = metrics.completion_eligibility_status ?? application?.completion_eligibility_status;
  const letterIssued = Boolean(metrics.completion_letter_issued_at || application?.completion_letter_issued_at);
  const reasons =
    metrics.completion_letter_gate?.reasons ??
    application?.eligibility_reason?.reasons ??
    application?.eligibility_reason?.details;

  if (!enabled) {
    return <p className="ft-manage-empty">{t('studentTraining.completionLocked')}</p>;
  }

  async function handleDownload() {
    if (!applicationId) return;
    setError('');
    setDownloading(true);
    try {
      const file = await downloadCompletionLetter(applicationId);
      saveCompletionLetterBlob(file);
    } catch (err) {
      setError(getApiErrorMessage(err, t('studentTraining.completion.downloadError')));
    } finally {
      setDownloading(false);
    }
  }

  async function handlePreview() {
    if (!applicationId) return;
    setError('');
    setPreviewing(true);
    try {
      await previewCompletionLetter(applicationId);
    } catch (err) {
      setError(getApiErrorMessage(err, t('studentTraining.completion.downloadError')));
    } finally {
      setPreviewing(false);
    }
  }

  return (
    <div className="ft-student-completion">
      <article className="ft-completion-letter-card">
        <div className="ft-completion-letter-card__icon" aria-hidden>
          <Award size={28} />
        </div>
        <div>
          <h3>{t('studentTraining.completion.title')}</h3>
          {letterIssued ? (
            <>
              <p>{t('studentTraining.completion.issued')}</p>
              <p className="ft-student-session-card__muted">
                {t('studentTraining.completion.issuedAt')}:{' '}
                {String(metrics.completion_letter_issued_at || application?.completion_letter_issued_at).slice(0, 10)}
              </p>
              <div className="ft-completion-card__actions">
                <Button
                  type="button"
                  variant="outline"
                  disabled={previewing}
                  onClick={handlePreview}
                >
                  <Eye size={16} aria-hidden />
                  {previewing ? t('studentTraining.completion.previewing') : t('completionLetter.preview')}
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  disabled={downloading}
                  onClick={handleDownload}
                >
                  <Download size={16} aria-hidden />
                  {downloading ? t('studentTraining.completion.downloading') : t('completionLetter.download')}
                </Button>
              </div>
            </>
          ) : eligibility === 'eligible' && !metrics.completion_letter_gate?.reasons?.length ? (
            <p>{t('studentTraining.completion.awaitingIssue')}</p>
          ) : (
            <>
              <p>{t('studentTraining.completion.pending')}</p>
              {Array.isArray(reasons) && reasons.length ? (
                <ul className="ft-eligibility-reasons">
                  {reasons.map((r) => (
                    <li key={String(r)}>{String(r)}</li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
          {eligibility ? (
            <StatusBadge variant={eligibility === 'eligible' ? 'success' : 'warning'}>
              {t(`eligibility.${eligibility}`)}
            </StatusBadge>
          ) : null}
        </div>
      </article>
      {error ? <p className="form-field__error">{error}</p> : null}
    </div>
  );
}

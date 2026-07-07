import { Ban } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function StudentExpelledBanner({ reason }) {
  const { t } = useTranslation('fieldTraining');

  return (
    <div className="ft-expelled-banner" role="alert">
      <Ban size={28} aria-hidden />
      <div>
        <h2 className="ft-expelled-banner__title">{t('studentTraining.expelledTitle')}</h2>
        <p className="ft-expelled-banner__text">{t('studentTraining.expelledText')}</p>
        {reason ? (
          <p className="ft-expelled-banner__reason">
            {t('studentTraining.expelledReason', { reason })}
          </p>
        ) : null}
      </div>
    </div>
  );
}

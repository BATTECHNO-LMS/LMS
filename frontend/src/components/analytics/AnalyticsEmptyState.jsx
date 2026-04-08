import { BarChart3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../utils/helpers.js';

export function AnalyticsEmptyState({ className }) {
  const { t } = useTranslation('analytics');

  return (
    <div className={cn('analytics-empty-state', className)}>
      <BarChart3 size={40} strokeWidth={1.25} aria-hidden className="analytics-empty-state__icon" />
      <p className="analytics-empty-state__title">{t('empty.title')}</p>
      <p className="analytics-empty-state__desc">{t('empty.description')}</p>
    </div>
  );
}

import { Lightbulb } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../utils/helpers.js';

export function AnalyticsInsightList({ items, className }) {
  const { t } = useTranslation('analytics');

  return (
    <ul className={cn('analytics-insight-list', className)}>
      {items.map((item, i) => (
        <li key={i} className="analytics-insight-list__item">
          <span className="analytics-insight-list__icon" aria-hidden>
            <Lightbulb size={18} />
          </span>
          <span>{t(`insights.${item.key}`, { ...(item.params ?? {}) })}</span>
        </li>
      ))}
    </ul>
  );
}

import { cn } from '../../utils/helpers.js';
import { useLocale } from '../../features/locale/index.js';
import { translateText } from '../../utils/i18n.js';

export function EmptyState({ title, description, action, className }) {
  const { locale } = useLocale();
  return (
    <div className={cn('empty-state', className)}>
      <p className="empty-state__title">{typeof title === 'string' ? translateText(title, locale) : title}</p>
      {description ? (
        <p className="empty-state__desc">
          {typeof description === 'string' ? translateText(description, locale) : description}
        </p>
      ) : null}
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}

import { Search } from 'lucide-react';
import { cn } from '../../utils/helpers.js';
import { useLocale } from '../../features/locale/index.js';
import { translateText } from '../../utils/i18n.js';

export function SearchInput({ className, inputClassName, ...rest }) {
  const { locale } = useLocale();
  const translatedRest = {
    ...rest,
    placeholder:
      typeof rest.placeholder === 'string' ? translateText(rest.placeholder, locale) : rest.placeholder,
    'aria-label':
      typeof rest['aria-label'] === 'string' ? translateText(rest['aria-label'], locale) : rest['aria-label'],
  };
  return (
    <div className={cn('search-input', className)}>
      <Search className="search-input__icon" size={18} aria-hidden />
      <input type="search" className={cn('search-input__control', inputClassName)} {...translatedRest} />
    </div>
  );
}

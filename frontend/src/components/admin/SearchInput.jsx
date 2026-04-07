import { Search } from 'lucide-react';
import { cn } from '../../utils/helpers.js';

export function SearchInput({ className, inputClassName, ...rest }) {
  return (
    <div className={cn('search-input', className)}>
      <Search className="search-input__icon" size={18} aria-hidden />
      <input type="search" className={cn('search-input__control', inputClassName)} {...rest} />
    </div>
  );
}

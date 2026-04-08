import { cn } from '../../utils/helpers.js';
import { Children, cloneElement, isValidElement } from 'react';
import { useLocale } from '../../features/locale/index.js';
import { translateText } from '../../utils/i18n.js';

export function FormSelect({
  id,
  label,
  error,
  className,
  selectClassName,
  children,
  ...rest
}) {
  const { locale } = useLocale();
  const translatedChildren = Children.map(children, (child) => {
    if (!isValidElement(child)) return child;
    const nextChildren =
      typeof child.props?.children === 'string'
        ? translateText(child.props.children, locale)
        : child.props?.children;
    return cloneElement(child, child.props, nextChildren);
  });
  return (
    <div className={cn('form-field', className)}>
      {label ? (
        <label className="form-field__label" htmlFor={id}>
          {typeof label === 'string' ? translateText(label, locale) : label}
        </label>
      ) : null}
      <select id={id} className={cn('form-field__control', selectClassName)} {...rest}>
        {translatedChildren}
      </select>
      {error ? <p className="form-field__error">{typeof error === 'string' ? translateText(error, locale) : error}</p> : null}
    </div>
  );
}

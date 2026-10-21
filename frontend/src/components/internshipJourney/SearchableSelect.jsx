import { useEffect, useId, useMemo, useRef, useState } from 'react';

/**
 * Accessible searchable select for mobile-first Arabic RTL forms.
 * Options: { value: string, label: string, keywords?: string }
 */
export function SearchableSelect({
  id,
  label,
  placeholder = 'اختر…',
  searchPlaceholder = 'ابحث…',
  value,
  options,
  onChange,
  disabled = false,
  error = '',
  required = false,
  emptyMessage = 'لا توجد نتائج',
}) {
  const listId = useId();
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);

  const selected = options.find((o) => o.value === value) || null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      const hay = `${o.label} ${o.keywords || ''} ${o.value}`.toLowerCase();
      return hay.includes(q);
    });
  }, [options, query]);

  useEffect(() => {
    if (!open) return undefined;
    function onDoc(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setHighlight(0);
      queueMicrotask(() => inputRef.current?.focus());
    }
  }, [open]);

  function selectOption(option) {
    onChange(option.value, option);
    setOpen(false);
  }

  function onKeyDown(e) {
    if (disabled) return;
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = filtered[highlight];
      if (opt) selectOption(opt);
    }
  }

  const describedBy = error ? `${id}-error` : undefined;

  return (
    <div className={`ij-field${disabled ? ' ij-field--disabled' : ''}${error ? ' ij-field--error' : ''}`} ref={rootRef}>
      <label htmlFor={id}>
        {label}
        {required ? <span className="ij-req" aria-hidden="true"> *</span> : null}
      </label>
      <button
        type="button"
        id={id}
        className="ij-combobox-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKeyDown}
      >
        <span className={selected ? '' : 'ij-placeholder'}>{selected ? selected.label : placeholder}</span>
        <span className="ij-combobox-chevron" aria-hidden="true">
          ▾
        </span>
      </button>

      {open ? (
        <div className="ij-combobox-panel" role="presentation">
          <input
            ref={inputRef}
            className="ij-combobox-search"
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlight(0);
            }}
            onKeyDown={onKeyDown}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            autoComplete="off"
          />
          <ul id={listId} className="ij-combobox-list" role="listbox" aria-label={label}>
            {filtered.length === 0 ? (
              <li className="ij-combobox-empty">{emptyMessage}</li>
            ) : (
              filtered.map((opt, index) => (
                <li key={opt.value} role="option" aria-selected={opt.value === value}>
                  <button
                    type="button"
                    className={`ij-combobox-option${index === highlight ? ' is-active' : ''}${
                      opt.value === value ? ' is-selected' : ''
                    }`}
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => selectOption(opt)}
                  >
                    {opt.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}

      {error ? (
        <p id={`${id}-error`} className="ij-field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

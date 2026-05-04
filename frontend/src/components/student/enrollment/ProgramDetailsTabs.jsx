import { cn } from '../../../utils/helpers.js';

/**
 * @param {{
 *   value: string,
 *   onChange: (id: string) => void,
 *   tabs: { id: string, label: string }[],
 *   children: import('react').ReactNode,
 * }} props
 */
export function ProgramDetailsTabs({ value, onChange, tabs, children }) {
  return (
    <div className="student-program-tabs">
      <div className="student-program-tabs__list" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={value === t.id}
            className={cn('student-program-tabs__tab', value === t.id && 'is-active')}
            onClick={() => onChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="student-program-tabs__panel" role="tabpanel">
        {children}
      </div>
    </div>
  );
}

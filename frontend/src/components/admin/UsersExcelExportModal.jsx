import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SelectField } from './SelectField.jsx';
import { useUniversities } from '../../features/universities/index.js';

/**
 * Modal to configure Users Excel export scope and filters.
 */
export function UsersExcelExportModal({
  open,
  busy,
  canExportAll,
  defaultUniversityId,
  onClose,
  onConfirm,
}) {
  const { t } = useTranslation('users');
  const { t: tCommon } = useTranslation('common');
  const [scope, setScope] = useState(canExportAll ? 'all' : 'university');
  const [universityId, setUniversityId] = useState(defaultUniversityId || '');
  const [applyFilters, setApplyFilters] = useState(true);

  const universitiesQuery = useUniversities({ enabled: open && canExportAll });
  const universities = useMemo(() => {
    const list = universitiesQuery.data?.universities ?? [];
    return Array.isArray(list) ? list : [];
  }, [universitiesQuery.data]);

  useEffect(() => {
    if (!open) return;
    setScope(canExportAll ? 'all' : 'university');
    setUniversityId(defaultUniversityId || '');
    setApplyFilters(true);
  }, [open, canExportAll, defaultUniversityId]);

  if (!open) return null;

  const needsUniversity = scope === 'university';
  const canSubmit = !busy && (!needsUniversity || Boolean(universityId));

  return (
    <div className="modal-overlay" role="presentation" onMouseDown={() => !busy && onClose?.()}>
      <div
        className="modal modal--confirm users-excel-export-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="users-excel-export-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="users-excel-export-title" className="modal__title">
          {t('export.title')}
        </h2>
        <p className="modal__message">{t('export.description')}</p>

        <div className="users-excel-export-modal__fields">
          <fieldset className="users-excel-export-modal__scope">
            <legend>{t('export.scopeLabel')}</legend>
            {canExportAll ? (
              <label className="users-excel-export-modal__radio">
                <input
                  type="radio"
                  name="export-scope"
                  checked={scope === 'all'}
                  disabled={busy}
                  onChange={() => setScope('all')}
                />
                <span>{t('export.scopeAll')}</span>
              </label>
            ) : null}
            <label className="users-excel-export-modal__radio">
              <input
                type="radio"
                name="export-scope"
                checked={scope === 'university'}
                disabled={busy || !canExportAll}
                onChange={() => setScope('university')}
              />
              <span>{t('export.scopeUniversity')}</span>
            </label>
          </fieldset>

          {needsUniversity ? (
            canExportAll ? (
              <SelectField
                id="export-university"
                label={t('export.university')}
                value={universityId}
                disabled={busy}
                onChange={(e) => setUniversityId(e.target.value)}
              >
                <option value="">—</option>
                {universities.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </SelectField>
            ) : (
              <p className="users-excel-export-modal__hint">{t('export.scopedUniversityHint')}</p>
            )
          ) : null}

          <label className="users-excel-export-modal__check">
            <input
              type="checkbox"
              checked={applyFilters}
              disabled={busy}
              onChange={(e) => setApplyFilters(e.target.checked)}
            />
            <span>{t('export.applyFilters')}</span>
          </label>
        </div>

        {busy ? (
          <p className="users-excel-export-modal__loading" role="status">
            {t('export.preparing')}
          </p>
        ) : null}

        <div className="modal__actions">
          <button type="button" className="btn btn--outline" disabled={busy} onClick={onClose}>
            {tCommon('actions.cancel')}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!canSubmit}
            onClick={() =>
              onConfirm?.({
                university_id:
                  scope === 'university'
                    ? universityId || defaultUniversityId || undefined
                    : undefined,
                apply_filters: applyFilters,
              })
            }
          >
            {t('export.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

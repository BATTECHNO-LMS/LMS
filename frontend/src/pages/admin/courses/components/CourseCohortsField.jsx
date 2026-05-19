import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FormSwitch } from '../../../../components/forms/FormSwitch.jsx';
import { LoadingSpinner } from '../../../../components/common/LoadingSpinner.jsx';
import { useCohorts } from '../../../../features/cohorts/index.js';

export function CourseCohortsField({ cohortIds = [], allStudents = true, onChange }) {
  const { t } = useTranslation('courses');
  const { t: tCohorts } = useTranslation('cohorts');
  const { data, isLoading, isError } = useCohorts({ page_size: 100 }, { staleTime: 60_000 });

  const cohorts = useMemo(() => {
    const list = data?.cohorts ?? [];
    return [...list].sort((a, b) => String(a.title).localeCompare(String(b.title), 'ar'));
  }, [data?.cohorts]);

  const selected = new Set(cohortIds);

  function setAllStudents(next) {
    onChange({ cohortIds: next ? [] : [...selected], allStudents: next });
  }

  function toggle(id) {
    if (allStudents) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange({ cohortIds: [...next], allStudents: false });
  }

  function cohortStatusLabel(status) {
    const key = `status.${status}`;
    const translated = tCohorts(key);
    return translated === key ? status : translated;
  }

  return (
    <div className="course-cohorts-field">
      <p className="course-cohorts-field__label">{t('form.cohorts')}</p>

      <div className="course-cohorts-field__all-students">
        <FormSwitch
          id="course-all-students"
          label={t('form.allStudents')}
          checked={allStudents}
          onChange={(e) => setAllStudents(e.target.checked)}
        />
        <p className="course-cohorts-field__hint">{t('form.allStudentsHint')}</p>
      </div>

      {!allStudents ? (
        <>
          <p className="course-cohorts-field__hint">{t('form.cohortsHint')}</p>
          {isLoading ? (
            <LoadingSpinner />
          ) : isError ? (
            <p className="crud-muted">{t('form.cohortsLoadError')}</p>
          ) : cohorts.length === 0 ? (
            <p className="crud-muted">{t('form.cohortsEmpty')}</p>
          ) : (
            <div
              className="course-cohorts-field__list"
              role="group"
              aria-label={t('form.cohorts')}
            >
              {cohorts.map((c) => (
                <label key={c.id} className="course-cohorts-field__item">
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggle(c.id)}
                  />
                  <span className="course-cohorts-field__item-title">{c.title}</span>
                  {c.status ? (
                    <span className="course-cohorts-field__item-status">
                      {cohortStatusLabel(c.status)}
                    </span>
                  ) : null}
                </label>
              ))}
            </div>
          )}
          {selected.size > 0 ? (
            <p className="course-cohorts-field__count">
              {t('form.cohortsSelected', { count: selected.size })}
            </p>
          ) : (
            <p className="course-cohorts-field__count course-cohorts-field__count--warn">
              {t('form.cohortsPickOne')}
            </p>
          )}
        </>
      ) : (
        <p className="course-cohorts-field__count course-cohorts-field__count--all">
          {t('form.cohortsAllStudentsActive')}
        </p>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * @param {{
 *   catalog: Array<{ id: string, name: string, specialties: Array<{ id: string, nameAr: string, nameEn?: string | null }> }>,
 *   value: Array<{ university_id: string, university_specialty_id: string, seats_limit?: number | null }>,
 *   onChange: (next: Array<{ university_id: string, university_specialty_id: string, seats_limit?: number | null }>) => void,
 *   loading?: boolean,
 *   error?: boolean,
 *   disabled?: boolean,
 * }} props
 */
export function FieldTrainingEligibilityPicker({
  catalog,
  value,
  onChange,
  loading,
  error,
  disabled,
}) {
  const { t, i18n } = useTranslation('fieldTraining');
  const [selectedUniversityIds, setSelectedUniversityIds] = useState([]);

  const catalogById = useMemo(
    () => Object.fromEntries(catalog.map((university) => [university.id, university])),
    [catalog]
  );

  useEffect(() => {
    const fromValue = [...new Set(value.map((row) => row.university_id))];
    setSelectedUniversityIds((prev) => {
      const merged = [...new Set([...prev, ...fromValue])];
      return merged.filter((id) => catalogById[id]);
    });
  }, [value, catalogById]);

  const selectedKeys = new Set(value.map((row) => `${row.university_id}:${row.university_specialty_id}`));

  function programLabel(program) {
    return i18n.language === 'ar' || i18n.language.startsWith('ar')
      ? program.nameAr || program.nameEn
      : program.nameEn || program.nameAr;
  }

  function toggleUniversity(universityId) {
    if (selectedUniversityIds.includes(universityId)) {
      setSelectedUniversityIds((prev) => prev.filter((id) => id !== universityId));
      onChange(value.filter((row) => row.university_id !== universityId));
      return;
    }
    setSelectedUniversityIds((prev) => [...prev, universityId]);
  }

  function toggleProgram(universityId, universitySpecialtyId) {
    const key = `${universityId}:${universitySpecialtyId}`;
    if (selectedKeys.has(key)) {
      onChange(value.filter((row) => `${row.university_id}:${row.university_specialty_id}` !== key));
      return;
    }
    onChange([
      ...value,
      { university_id: universityId, university_specialty_id: universitySpecialtyId },
    ]);
  }

  if (loading) {
    return (
      <div className="ft-eligibility ft-eligibility--loading" aria-busy="true">
        <p className="ft-eligibility__status">{t('form.eligibilityLoading')}</p>
        <div className="ft-eligibility__skeleton-chips">
          {[1, 2, 3, 4, 5].map((i) => (
            <span key={i} className="ft-eligibility__skeleton-chip" aria-hidden />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return <p className="ft-modal__error">{t('form.eligibilityLoadError')}</p>;
  }

  if (!catalog.length) {
    return <p className="ft-eligibility__status">{t('form.eligibilityEmpty')}</p>;
  }

  return (
    <div className="ft-eligibility">
      <div className="ft-eligibility__section">
        <h4 className="ft-eligibility__section-title">{t('form.beneficiaryUniversities')}</h4>
        <p className="ft-eligibility__section-help">{t('form.beneficiaryUniversitiesHelp')}</p>
        <div className="ft-eligibility__university-select">
          {catalog.map((university) => {
            const checked = selectedUniversityIds.includes(university.id);
            return (
              <label key={university.id} className="ft-eligibility__option ft-eligibility__option--inline ft-eligibility__option--chip">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggleUniversity(university.id)}
                />
                <span>{university.name}</span>
              </label>
            );
          })}
        </div>
      </div>

      {selectedUniversityIds.length > 0 ? (
        <div className="ft-eligibility__section">
          <h4 className="ft-eligibility__section-title">{t('form.eligibleProgramsSection')}</h4>
          <p className="ft-eligibility__section-help">{t('form.eligibleProgramsHelp')}</p>
          <div className="ft-eligibility__cards">
            {selectedUniversityIds.map((universityId) => {
              const university = catalogById[universityId];
              if (!university) return null;
              const programs = university.specialties ?? [];
              return (
                <div key={university.id} className="ft-eligibility__university">
                  <h4 className="ft-eligibility__university-name">{university.name}</h4>
                  {programs.length ? (
                    <div className="ft-eligibility__programs">
                      {programs.map((program) => {
                        const checked = selectedKeys.has(`${university.id}:${program.id}`);
                        return (
                          <label key={program.id} className="ft-eligibility__option">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={disabled}
                              onChange={() => toggleProgram(university.id, program.id)}
                            />
                            <span>{programLabel(program)}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="ft-eligibility__status">{t('form.universityNoSpecialties')}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="ft-eligibility__status">{t('form.selectUniversityFirst')}</p>
      )}
    </div>
  );
}

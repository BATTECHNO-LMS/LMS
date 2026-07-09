import { useTranslation } from 'react-i18next';
import { getOpportunitySpecialtyLabel } from '../../../../features/fieldTraining/index.js';

function programLabel(program, lang) {
  const spec = program?.university_specialty;
  if (!spec) return '—';
  return getOpportunitySpecialtyLabel({ specialty: spec }, lang, '—');
}

/**
 * @param {{
 *   grouped?: Array<{
 *     university_id: string,
 *     university?: { id: string, name: string } | null,
 *     application_count?: number,
 *     programs: Array<{
 *       university_specialty_id: string,
 *       seats_limit?: number | null,
 *       application_count?: number,
 *       university_specialty?: { name_ar?: string, name_en?: string } | null,
 *     }>,
 *   }>,
 * }} props
 */
export function BeneficiaryUniversitiesSection({ grouped = [] }) {
  const { t, i18n } = useTranslation('fieldTraining');

  if (!grouped.length) {
    return <p className="ft-beneficiary__empty">{t('detail.noBeneficiaryPrograms')}</p>;
  }

  return (
    <section className="ft-beneficiary" aria-labelledby="ft-beneficiary-title">
      <h3 id="ft-beneficiary-title" className="ft-beneficiary__title">
        {t('detail.beneficiarySection')}
      </h3>
      <div className="ft-beneficiary__grid">
        {grouped.map((entry) => (
          <article key={entry.university_id} className="ft-beneficiary__card">
            <header className="ft-beneficiary__card-head">
              <h4>{entry.university?.name ?? t('form.universityUnspecified')}</h4>
              {entry.application_count != null ? (
                <span className="ft-beneficiary__count">
                  {t('detail.universityApplications', { count: entry.application_count })}
                </span>
              ) : null}
            </header>
            <ul className="ft-beneficiary__programs">
              {entry.programs.map((program) => (
                <li key={program.university_specialty_id}>
                  <span>{programLabel(program, i18n.language)}</span>
                  <span className="ft-beneficiary__meta">
                    {program.seats_limit != null
                      ? t('detail.programSeats', { count: program.seats_limit })
                      : null}
                    {program.application_count != null
                      ? t('detail.programApplications', { count: program.application_count })
                      : null}
                  </span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

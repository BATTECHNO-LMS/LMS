import { useTranslation } from 'react-i18next';

/**
 * @param {{ initials: string, nameKey: string, category: 'ministry' | 'university', logoUrl?: string, descriptionKey: string }} props
 */
export function PartnerCard({ initials, nameKey, category, logoUrl, descriptionKey }) {
  const { t } = useTranslation('landing');
  const badgeKey = category === 'ministry' ? 'partners.categoryMinistry' : 'partners.categoryUniversity';
  const title = t(nameKey);
  const description = t(descriptionKey);

  return (
    <article className="group relative flex h-full flex-col items-center overflow-hidden rounded-3xl border border-bat-border/90 bg-bat-surface px-6 pb-8 pt-8 text-center shadow-[0_4px_24px_-8px_rgba(19,45,74,0.08)] transition duration-300 hover:-translate-y-1 hover:border-bat-accent/50 hover:shadow-[0_20px_44px_-18px_rgba(19,45,74,0.14)] sm:px-7">
      <div
        className="pointer-events-none absolute -end-10 -top-10 h-32 w-32 rounded-full bg-bat-accent/15 opacity-0 blur-3xl transition duration-500 group-hover:opacity-100"
        aria-hidden
      />

      <div className="relative flex h-[5.5rem] w-[5.5rem] shrink-0 items-center justify-center rounded-full border border-bat-border/90 bg-bat-surface shadow-[0_6px_20px_-6px_rgba(19,45,74,0.12)] ring-1 ring-bat-border-tinted sm:h-24 sm:w-24">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt=""
            className="h-[68%] w-[68%] object-contain object-center"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="text-base font-black text-bat-primary-light" aria-hidden>
            {initials}
          </span>
        )}
      </div>

      <h3 className="relative mt-6 text-base font-bold leading-snug text-bat-ink sm:text-[1.05rem]">{title}</h3>

      <span className="relative mt-2.5 inline-flex rounded-full border border-bat-border/90 bg-bat-surface-header px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-bat-muted">
        {t(badgeKey)}
      </span>

      <p className="relative mt-4 max-w-sm text-sm leading-relaxed text-bat-muted line-clamp-3 sm:min-h-[4.5rem]">{description}</p>
    </article>
  );
}

import { useTranslation } from 'react-i18next';

/**
 * @param {{ initials: string, nameKey: string, category: 'ministry' | 'university' }} props
 */
export function PartnerCard({ initials, nameKey, category }) {
  const { t } = useTranslation('landing');
  const badgeKey = category === 'ministry' ? 'partners.categoryMinistry' : 'partners.categoryUniversity';

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)] transition duration-200 hover:-translate-y-0.5 hover:border-amber-300/60 hover:shadow-[0_12px_40px_-12px_rgba(212,154,42,0.2)]">
      <div
        className="pointer-events-none absolute -end-8 -top-8 h-24 w-24 rounded-full bg-sky-100/80 opacity-0 blur-2xl transition group-hover:opacity-100"
        aria-hidden
      />
      <div className="relative flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-sky-50 to-amber-50 text-lg font-black text-slate-800 ring-1 ring-slate-200/80 transition group-hover:ring-amber-200/80">
        <span aria-hidden>{initials}</span>
      </div>
      <h3 className="relative mt-4 text-base font-bold leading-snug text-slate-900">{t(nameKey)}</h3>
      <span className="relative mt-3 inline-flex w-fit rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200/80 transition group-hover:bg-amber-50 group-hover:text-amber-900 group-hover:ring-amber-200/60">
        {t(badgeKey)}
      </span>
    </article>
  );
}

import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { PARTNER_INSTITUTIONS } from './home.constants.js';
import { PartnerCard } from './PartnerCard.jsx';

export function HomePartners() {
  const { t } = useTranslation('landing');

  return (
    <section id="partners" className="relative scroll-mt-20 bg-[#FAFAF7] py-16 sm:py-24">
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(212, 154, 42, 0.05), transparent 55%), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(148, 163, 184, 0.06), transparent)',
        }}
      />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="mx-auto max-w-3xl text-center"
        >
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700/90">{t('header.navPartners')}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{t('partners.sectionTitle')}</h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">{t('partners.sectionSubtitle')}</p>
        </motion.div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PARTNER_INSTITUTIONS.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: i * 0.05 }}
            >
              <PartnerCard initials={p.initials} nameKey={p.nameKey} category={p.category} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

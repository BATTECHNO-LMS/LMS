import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { PARTNER_INSTITUTIONS } from './home.constants.js';
import { PartnerCard } from './PartnerCard.jsx';

export function PartnersSection() {
  const { t } = useTranslation('landing');

  return (
    <section id="partners" className="relative scroll-mt-20 border-t border-bat-border/70 bg-bat-bg py-20 sm:py-28">
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-bat-muted">{t('header.navPartners')}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-bat-ink sm:text-[2rem] sm:leading-tight">
            {t('partners.sectionTitle')}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-bat-muted sm:text-lg">{t('partners.sectionSubtitle')}</p>
        </motion.div>

        <div className="mt-14 grid auto-rows-fr gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-7">
          {PARTNER_INSTITUTIONS.map((p, i) => (
            <motion.div
              key={p.id}
              className="flex h-full"
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.4, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
            >
              <PartnerCard
                initials={p.initials}
                nameKey={p.nameKey}
                category={p.category}
                logoUrl={p.logoUrl}
                descriptionKey={p.descriptionKey}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

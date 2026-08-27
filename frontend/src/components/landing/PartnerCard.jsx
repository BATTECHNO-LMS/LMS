import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useLandingMotion, MOTION_DURATION } from './motion/index.js';

/**
 * @param {{ initials: string, nameKey: string, category: 'ministry' | 'university', logoUrl?: string, descriptionKey: string }} props
 */
export function PartnerCard({ initials, nameKey, category, logoUrl, descriptionKey }) {
  const { t } = useTranslation('landing');
  const { reduced, cardHover, transition } = useLandingMotion();
  const badgeKey = category === 'ministry' ? 'partners.categoryMinistry' : 'partners.categoryUniversity';
  const title = t(nameKey);
  const description = t(descriptionKey);

  const logoHover = reduced
    ? {}
    : {
        scale: 1.04,
        transition: transition(MOTION_DURATION.fast),
      };

  return (
    <motion.article
      whileHover={cardHover}
      transition={transition(MOTION_DURATION.fast)}
      className={`partner-card partner-card--${category} group relative flex h-full w-full flex-col items-center overflow-hidden text-center`}
    >
      <span className="partner-card__accent" aria-hidden />
      <span className="partner-card__watermark" aria-hidden />
      <span className="partner-card__glow" aria-hidden />

      <div className="partner-card__logo relative z-[1]">
        {logoUrl ? (
          <motion.div whileHover={logoHover} className="partner-card__logo-inner">
            <img
              src={logoUrl}
              alt=""
              width={180}
              height={180}
              className="partner-card__logo-img"
              loading="lazy"
              decoding="async"
            />
          </motion.div>
        ) : (
          <span className="partner-card__logo-inner text-xl font-black text-bat-primary sm:text-2xl" aria-hidden>
            {initials}
          </span>
        )}
      </div>

      <h3 className="partner-card__title relative z-[1]">{title}</h3>

      <span className="partner-card__pill relative z-[1]">{t(badgeKey)}</span>

      <p className="partner-card__desc relative z-[1]">{description}</p>
    </motion.article>
  );
}

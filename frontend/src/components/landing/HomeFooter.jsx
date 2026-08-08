import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { LandingBrandLogo } from './LandingBrandLogo.jsx';
import { LandingCtaButton } from './motion/index.js';

export function HomeFooter() {
  const { t } = useTranslation('landing');
  const year = new Date().getFullYear();

  return (
    <footer id="contact" className="landing-footer">
      <div className="landing-footer__decor" aria-hidden>
        <span className="landing-footer__wave landing-footer__wave--cream" />
        <span className="landing-footer__wave landing-footer__wave--gold" />
        <span className="landing-footer__wave-line" />
        <span className="landing-footer__glow" />
        <span className="landing-footer__dots" />
        <span className="landing-footer__watermark" />
      </div>

      <div className="landing-container landing-footer__inner">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
          className="landing-footer__grid"
        >
          <div className="landing-footer__brand">
            <LandingBrandLogo
              variant="footer"
              alt={t('brand')}
              className="!mb-0 !h-11 sm:!h-12 lg:!h-[3.25rem] lg:max-w-[280px]"
            />
            <p className="landing-footer__desc">{t('footer.description')}</p>
            <p className="landing-footer__tagline">{t('footer.tagline')}</p>
          </div>

          <div className="landing-footer__col">
            <p className="landing-footer__label">{t('footer.support')}</p>
            <ul className="landing-footer__links">
              <li>
                <a href="mailto:privacy@battechno.com" className="landing-footer__link">
                  {t('footer.contact')}
                </a>
              </li>
              <li>
                <Link to="/privacy-policy" className="landing-footer__link">
                  {t('footer.privacy')}
                </Link>
              </li>
              <li>
                <Link to="/account-deletion" className="landing-footer__link">
                  {t('footer.accountDeletion')}
                </Link>
              </li>
              <li>
                <span className="landing-footer__link landing-footer__link--muted">{t('footer.terms')}</span>
              </li>
            </ul>
          </div>

          <div className="landing-footer__col landing-footer__col--actions">
            <p className="landing-footer__label">{t('header.login')}</p>
            <div className="landing-footer__actions">
              <LandingCtaButton to="/portals" variant="secondary" className="landing-footer__btn">
                {t('header.login')}
              </LandingCtaButton>
              <LandingCtaButton to="/institutions/register" variant="primary" className="landing-footer__btn">
                {t('header.register')}
              </LandingCtaButton>
            </div>
          </div>
        </motion.div>

        <div className="landing-footer__bottom">
          <span className="landing-footer__divider" aria-hidden />
          <div className="landing-footer__meta">
            <p>{t('footer.rights', { year: String(year) })}</p>
            <p className="landing-footer__meta-brand">BATTECHNO · 2017</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

export function HomeFooter() {
  const { t } = useTranslation('landing');
  const year = new Date().getFullYear();

  return (
    <footer className="relative border-t border-bat-border/90 bg-bat-surface pt-16 pb-12">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-bat-border/90"
        aria-hidden
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div className="lg:col-span-2">
            <p className="text-2xl font-extrabold tracking-tight text-bat-ink">{t('brand')}</p>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-bat-muted">{t('hero.companyLead')}</p>
            <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-bat-muted">{t('footer.tagline')}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-bat-muted">{t('footer.support')}</p>
            <ul className="mt-4 space-y-3 text-sm text-bat-text">
              <li>
                <a href="mailto:support@battechno.example" className="transition hover:text-bat-primary">
                  {t('footer.contact')}
                </a>
              </li>
              <li>
                <span className="cursor-default text-bat-muted">{t('footer.privacy')}</span>
              </li>
              <li>
                <span className="cursor-default text-bat-muted">{t('footer.terms')}</span>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-bat-muted">{t('header.login')}</p>
            <div className="mt-4 flex flex-col gap-3">
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-xl border border-bat-accent bg-bat-accent-soft px-4 py-3 text-sm font-semibold text-bat-primary shadow-sm transition hover:border-bat-accent-hover hover:bg-bat-accent"
              >
                {t('header.login')}
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center justify-center rounded-xl bg-bat-primary px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-bat-primary-hover"
              >
                {t('header.register')}
              </Link>
            </div>
          </div>
        </motion.div>
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-bat-border/90 pt-8 text-xs text-bat-muted sm:flex-row">
          <p>{t('footer.rights', { year: String(year) })}</p>
          <p className="font-medium text-bat-text">BATTECHNO · 2017</p>
        </div>
      </div>
    </footer>
  );
}

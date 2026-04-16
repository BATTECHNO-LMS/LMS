import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

export function HomeFooter() {
  const { t } = useTranslation('landing');
  const year = new Date().getFullYear();

  return (
    <footer className="relative border-t border-white/10 bg-gradient-to-b from-slate-950 to-black pt-16 pb-10">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent"
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
            <p className="text-2xl font-extrabold tracking-tight text-white">{t('brand')}</p>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-400">{t('hero.companyLead')}</p>
            <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-amber-400/80">{t('footer.tagline')}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{t('footer.support')}</p>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              <li>
                <a href="mailto:support@battechno.example" className="transition hover:text-amber-300">
                  {t('footer.contact')}
                </a>
              </li>
              <li>
                <span className="cursor-default text-slate-500">{t('footer.privacy')}</span>
              </li>
              <li>
                <span className="cursor-default text-slate-500">{t('footer.terms')}</span>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{t('header.login')}</p>
            <div className="mt-4 flex flex-col gap-3">
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                {t('header.login')}
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-3 text-sm font-bold text-slate-950 shadow-md transition hover:brightness-105"
              >
                {t('header.register')}
              </Link>
            </div>
          </div>
        </motion.div>
        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-xs text-slate-500 sm:flex-row">
          <p>{t('footer.rights', { year: String(year) })}</p>
          <p className="font-medium text-slate-600">BATTECHNO · 2017</p>
        </div>
      </div>
    </footer>
  );
}

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocale } from '../../features/locale/index.js';
import {
  FiGrid,
  FiUsers,
  FiBookOpen,
  FiAward,
  FiChevronRight,
  FiHome,
  FiTrendingUp,
  FiBook,
  FiUser,
} from 'react-icons/fi';

/**
 * Interactive in-frame LMS preview (real JSX, not an image).
 * @param {{ variant?: 'device' | 'standalone', className?: string }} props
 */
export function BattechnoPhoneApp({ variant = 'device', className = '' }) {
  const { t } = useTranslation('landing');
  const { dir } = useLocale();
  const [panel, setPanel] = useState('overview');

  const framed = variant === 'device';

  const bottomActive = useMemo(() => {
    if (panel === 'successPartners') return 'success';
    if (panel === 'academicPartners') return 'academic';
    if (panel === 'quick') return 'account';
    return 'home';
  }, [panel]);

  const screenHeight = framed ? 'h-[600px]' : 'min-h-[72vh] max-h-[88vh]';

  const screen = (
    <div
      className={`relative z-10 flex flex-col overflow-hidden bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 text-slate-100 ${screenHeight} ${
        framed ? 'rounded-[2.25rem]' : 'rounded-3xl'
      } border border-white/15 shadow-glass`}
      style={{ pointerEvents: 'auto' }}
    >
      {framed ? (
        <div
          className="pointer-events-none absolute left-1/2 top-0 z-20 h-6 w-32 -translate-x-1/2 rounded-b-2xl bg-black/80 ring-1 ring-white/10"
          aria-hidden
        />
      ) : null}

      <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/10 px-4 pb-3 pt-7">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/30 to-amber-600/10 text-amber-300 ring-1 ring-amber-500/30">
            <FiGrid size={20} />
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-bold tracking-tight text-white">{t('brand')}</p>
            <p className="truncate text-[11px] text-slate-400">{t('phone.subtitle')}</p>
          </div>
        </div>
        <FiChevronRight className={`shrink-0 text-slate-500 ${dir === 'rtl' ? 'rotate-180' : ''}`} aria-hidden />
      </header>

      <div className="relative z-10 shrink-0 border-b border-white/10 px-4 py-4">
        <p className="text-xl font-bold tracking-tight text-white">{t('phone.greeting')}</p>
        <p className="mt-1 text-xs text-slate-400">{t('hero.badge')}</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { label: 'statActive', val: 'statActiveVal' },
            { label: 'statPending', val: 'statPendingVal' },
            { label: 'statCerts', val: 'statCertsVal' },
          ].map(({ label, val }) => (
            <div
              key={label}
              className="rounded-xl border border-white/10 bg-white/[0.06] px-2 py-2 text-center shadow-inner"
            >
              <p className="text-lg font-bold tabular-nums text-white">{t(`phone.${val}`)}</p>
              <p className="mt-0.5 text-[10px] font-medium leading-tight text-slate-400">{t(`phone.${label}`)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-10 shrink-0 grid grid-cols-2 gap-2 px-3 py-3">
        <button
          type="button"
          onClick={() => setPanel('successPartners')}
          className={`rounded-2xl border px-2 py-3 text-center text-[11px] font-semibold leading-snug transition ${
            panel === 'successPartners'
              ? 'border-amber-400/70 bg-gradient-to-br from-amber-500/25 to-amber-600/5 text-amber-100 shadow-lg shadow-amber-900/20'
              : 'border-white/10 bg-white/[0.05] text-slate-200 hover:border-white/20 hover:bg-white/10'
          }`}
        >
          {t('phone.btnSuccessPartners')}
        </button>
        <button
          type="button"
          onClick={() => setPanel('academicPartners')}
          className={`rounded-2xl border px-2 py-3 text-center text-[11px] font-semibold leading-snug transition ${
            panel === 'academicPartners'
              ? 'border-sky-400/70 bg-gradient-to-br from-sky-500/20 to-sky-700/5 text-sky-100 shadow-lg shadow-sky-900/20'
              : 'border-white/10 bg-white/[0.05] text-slate-200 hover:border-white/20 hover:bg-white/10'
          }`}
        >
          {t('phone.btnAcademicPartners')}
        </button>
        <Link
          to="/register"
          className="flex items-center justify-center rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 px-2 py-3 text-center text-[11px] font-bold text-slate-950 shadow-md ring-1 ring-amber-300/40 transition hover:brightness-105"
        >
          {t('phone.btnRegister')}
        </Link>
        <Link
          to="/login"
          className="flex items-center justify-center rounded-2xl border border-white/25 bg-white/[0.12] px-2 py-3 text-center text-[11px] font-bold text-white shadow-inner transition hover:bg-white/20"
        >
          {t('phone.btnLogin')}
        </Link>
      </div>

      <div className="relative z-10 flex shrink-0 gap-1 border-b border-white/10 px-3 py-2">
        <button
          type="button"
          onClick={() => setPanel('overview')}
          className={`flex-1 rounded-xl py-2 text-xs font-semibold transition ${
            panel === 'overview' ? 'bg-white/15 text-white shadow-sm' : 'text-slate-400 hover:bg-white/10 hover:text-white'
          }`}
        >
          {t('phone.tabOverview')}
        </button>
        <button
          type="button"
          onClick={() => setPanel('quick')}
          className={`flex-1 rounded-xl py-2 text-xs font-semibold transition ${
            panel === 'quick' ? 'bg-white/15 text-white shadow-sm' : 'text-slate-400 hover:bg-white/10 hover:text-white'
          }`}
        >
          {t('phone.tabQuick')}
        </button>
      </div>

      <div className="relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={panel}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {panel === 'overview' ? (
              <>
                <p className="text-sm leading-relaxed text-slate-300">{t('phone.views.overview')}</p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    className="rounded-2xl border border-white/10 bg-white/[0.06] p-3 text-center transition hover:border-amber-500/40"
                  >
                    <FiBookOpen className="mx-auto mb-2 text-xl text-amber-400" />
                    <p className="text-[10px] font-semibold leading-tight text-slate-200">{t('phone.overviewCard1')}</p>
                  </button>
                  <button
                    type="button"
                    className="rounded-2xl border border-white/10 bg-white/[0.06] p-3 text-center transition hover:border-sky-500/40"
                  >
                    <FiUsers className="mx-auto mb-2 text-xl text-sky-400" />
                    <p className="text-[10px] font-semibold leading-tight text-slate-200">{t('phone.overviewCard2')}</p>
                  </button>
                  <button
                    type="button"
                    className="rounded-2xl border border-white/10 bg-white/[0.06] p-3 text-center transition hover:border-emerald-500/40"
                  >
                    <FiAward className="mx-auto mb-2 text-xl text-emerald-400" />
                    <p className="text-[10px] font-semibold leading-tight text-slate-200">{t('phone.overviewCard3')}</p>
                  </button>
                </div>
              </>
            ) : null}
            {panel === 'successPartners' ? (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                <p className="text-sm leading-relaxed text-slate-200">{t('phone.views.successPartners')}</p>
              </div>
            ) : null}
            {panel === 'academicPartners' ? (
              <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4">
                <p className="text-sm leading-relaxed text-slate-200">{t('phone.views.academicPartners')}</p>
              </div>
            ) : null}
            {panel === 'quick' ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-300">{t('phone.views.quick')}</p>
                <div className="flex flex-col gap-3">
                  <Link
                    to="/register"
                    className="block rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 py-3.5 text-center text-sm font-bold text-slate-950 shadow-lg"
                  >
                    {t('hero.ctaRegister')}
                  </Link>
                  <Link
                    to="/login"
                    className="block rounded-2xl border border-white/25 bg-white/10 py-3.5 text-center text-sm font-bold text-white"
                  >
                    {t('hero.ctaLogin')}
                  </Link>
                </div>
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>

      <nav
        className="relative z-10 flex shrink-0 items-stretch justify-around gap-1 border-t border-white/10 bg-slate-950/95 px-1 py-2 backdrop-blur-md"
        aria-label="App"
      >
        {[
          { id: 'home', panel: 'overview', icon: FiHome, label: 'navHome' },
          { id: 'success', panel: 'successPartners', icon: FiTrendingUp, label: 'navSuccess' },
          { id: 'academic', panel: 'academicPartners', icon: FiBook, label: 'navAcademic' },
          { id: 'account', panel: 'quick', icon: FiUser, label: 'navAccount' },
        ].map(({ id, panel: p, icon: Icon, label }) => {
          const active = bottomActive === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setPanel(p)}
              className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-semibold transition ${
                active ? 'text-amber-300' : 'text-slate-500 hover:text-slate-200'
              }`}
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                  active ? 'bg-amber-500/20 ring-1 ring-amber-400/40' : 'bg-transparent'
                }`}
              >
                <Icon size={18} aria-hidden />
              </span>
              <span className="truncate px-0.5">{t(`phone.${label}`)}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );

  if (!framed) {
    return <div className={`mx-auto w-full max-w-md ${className}`}>{screen}</div>;
  }

  return (
    <div className={`relative mx-auto w-full max-w-[420px] ${className}`} style={{ pointerEvents: 'auto' }}>
      <div
        className="rounded-[3rem] bg-gradient-to-b from-slate-500 via-slate-800 to-slate-950 p-[10px] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.75)] ring-1 ring-white/15 sm:p-3"
        style={{ pointerEvents: 'auto' }}
      >
        {screen}
      </div>
    </div>
  );
}

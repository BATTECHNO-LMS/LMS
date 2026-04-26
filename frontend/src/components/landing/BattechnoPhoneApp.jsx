import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocale } from '../../features/locale/index.js';
import { PARTNER_INSTITUTIONS } from './home.constants.js';
import {
  FiHome,
  FiAward,
  FiUsers,
  FiUser,
  FiChevronRight,
} from 'react-icons/fi';

/** @typedef {'home' | 'credentials' | 'partners' | 'account'} PhoneScreen */

/**
 * Interactive iPhone-style LMS preview (real JSX).
 * @param {{ variant?: 'device' | 'standalone', className?: string }} props
 */
export function BattechnoPhoneApp({ variant = 'device', className = '' }) {
  const { t } = useTranslation('landing');
  const { dir } = useLocale();
  const [activeScreen, setActiveScreen] = useState(/** @type {PhoneScreen} */ ('home'));

  const framed = variant === 'device';

  const bottomNav = useMemo(
    () => [
      { id: /** @type {PhoneScreen} */ ('home'), icon: FiHome, labelKey: 'phone.navHome' },
      { id: 'credentials', icon: FiAward, labelKey: 'phone.navCredentials' },
      { id: 'partners', icon: FiUsers, labelKey: 'phone.navPartners' },
      { id: 'account', icon: FiUser, labelKey: 'phone.navAccount' },
    ],
    []
  );

  const credentialSamples = useMemo(
    () => [
      { titleKey: 'phone.credentials.card1Title', statusKey: 'phone.credentials.statusPublished', tone: 'emerald' },
      { titleKey: 'phone.credentials.card2Title', statusKey: 'phone.credentials.statusReview', tone: 'amber' },
      { titleKey: 'phone.credentials.card3Title', statusKey: 'phone.credentials.statusDraft', tone: 'slate' },
    ],
    []
  );

  const screenBody = (
    <div
      className={`relative z-10 flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-[2.35rem] bg-gradient-to-b from-slate-50 to-slate-100 text-slate-800 shadow-inner ${
        framed ? '' : 'rounded-3xl'
      }`}
      dir={dir}
    >
      {/* Dynamic Island */}
      {framed ? (
        <div
          className="pointer-events-none absolute left-1/2 top-3 z-30 h-[1.35rem] w-[5.5rem] -translate-x-1/2 rounded-full bg-black shadow-md ring-1 ring-black/40"
          aria-hidden
        />
      ) : null}

      <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-slate-200/90 bg-white/90 px-4 pb-2.5 pt-9 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/90 to-amber-600 text-sm font-black text-white shadow-sm ring-1 ring-amber-500/30">
            B
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[13px] font-bold tracking-tight text-slate-900">{t('brand')}</p>
            <p className="truncate text-[10px] font-medium text-slate-500">{t('phone.previewBadge')}</p>
          </div>
        </div>
        <FiChevronRight className={`shrink-0 text-slate-400 ${dir === 'rtl' ? 'rotate-180' : ''}`} aria-hidden />
      </header>

      <div className="relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain px-3.5 pb-3 pt-2">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeScreen}
            initial={{ opacity: 0, x: dir === 'rtl' ? -8 : 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir === 'rtl' ? 8 : -8 }}
            transition={{ duration: 0.22 }}
            className="space-y-3"
          >
            {activeScreen === 'home' ? (
              <div className="space-y-3">
                <div>
                  <p className="text-[11px] font-semibold text-slate-500">{t('phone.home.greeting')}</p>
                  <p className="text-lg font-black leading-tight text-slate-900">{t('phone.home.platform')}</p>
                  <p className="mt-0.5 text-[11px] text-slate-600">{t('phone.home.tagline')}</p>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { l: 'phone.home.statMicro', v: 'phone.home.statMicroVal' },
                    { l: 'phone.home.statUniv', v: 'phone.home.statUnivVal' },
                    { l: 'phone.home.statCohort', v: 'phone.home.statCohortVal' },
                  ].map(({ l, v }) => (
                    <div
                      key={l}
                      className="rounded-xl border border-slate-200/80 bg-white px-1.5 py-2 text-center shadow-sm"
                    >
                      <p className="text-base font-bold tabular-nums text-amber-700">{t(v)}</p>
                      <p className="mt-0.5 text-[9px] font-semibold leading-tight text-slate-600">{t(l)}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Link
                    to="/register"
                    className="flex min-h-[2.75rem] items-center justify-center rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-center text-[11px] font-bold text-slate-950 shadow-sm ring-1 ring-amber-500/20"
                  >
                    {t('hero.ctaRegister')}
                  </Link>
                  <Link
                    to="/login"
                    className="flex min-h-[2.75rem] items-center justify-center rounded-xl border border-slate-300 bg-white text-center text-[11px] font-bold text-slate-800 shadow-sm"
                  >
                    {t('hero.ctaLogin')}
                  </Link>
                </div>
              </div>
            ) : null}

            {activeScreen === 'credentials' ? (
              <div className="space-y-2.5">
                <div>
                  <p className="text-sm font-bold text-slate-900">{t('phone.credentials.title')}</p>
                  <p className="text-[10px] text-slate-500">{t('phone.credentials.subtitle')}</p>
                </div>
                {credentialSamples.map((c) => (
                  <div
                    key={c.titleKey}
                    className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 text-[11px] font-bold leading-snug text-slate-900">{t(c.titleKey)}</p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${
                          c.tone === 'emerald'
                            ? 'bg-emerald-100 text-emerald-800'
                            : c.tone === 'amber'
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {t(c.statusKey)}
                      </span>
                    </div>
                  </div>
                ))}
                <Link
                  to="/register"
                  className="mt-1 flex min-h-[2.5rem] w-full items-center justify-center rounded-xl border border-amber-300/80 bg-amber-50 text-[11px] font-bold text-amber-950"
                >
                  {t('phone.credentials.exploreCta')}
                </Link>
              </div>
            ) : null}

            {activeScreen === 'partners' ? (
              <div className="space-y-2">
                <div>
                  <p className="text-sm font-bold text-slate-900">{t('phone.partners.title')}</p>
                  <p className="text-[10px] text-slate-500">{t('phone.partners.subtitle')}</p>
                </div>
                <ul className="space-y-1.5">
                  {PARTNER_INSTITUTIONS.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2 shadow-sm"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-100 to-slate-100 text-[11px] font-black text-sky-900 ring-1 ring-sky-200/80">
                        {p.initials}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-bold text-slate-900">{t(p.nameKey)}</p>
                        <span className="mt-0.5 inline-block rounded-md bg-slate-100 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-slate-600">
                          {t(p.category === 'ministry' ? 'partners.categoryMinistry' : 'partners.categoryUniversity')}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {activeScreen === 'account' ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">{t('phone.account.title')}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{t('phone.account.intro')}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    to="/register"
                    className="flex min-h-[2.65rem] items-center justify-center rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-[11px] font-bold text-slate-950 shadow-sm"
                  >
                    {t('hero.ctaRegister')}
                  </Link>
                  <Link
                    to="/login"
                    className="flex min-h-[2.65rem] items-center justify-center rounded-xl border border-slate-300 bg-white text-[11px] font-bold text-slate-800"
                  >
                    {t('hero.ctaLogin')}
                  </Link>
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{t('capabilities.subtitle')}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { k: 'phone.account.roleStudent' },
                    { k: 'phone.account.roleInstructor' },
                    { k: 'phone.account.roleReviewer' },
                    { k: 'phone.account.roleAdmin' },
                  ].map(({ k }) => (
                    <Link
                      key={k}
                      to="/login"
                      className="flex min-h-[2.4rem] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-center text-[10px] font-bold text-slate-800 transition hover:border-amber-300 hover:bg-amber-50/80"
                    >
                      {t(k)}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>

      <nav
        className="relative z-10 flex shrink-0 items-stretch justify-around gap-0.5 border-t border-slate-200/90 bg-white/95 px-1 py-1.5 backdrop-blur-md"
        aria-label={t('phone.previewBadge')}
      >
        {bottomNav.map(({ id, icon: Icon, labelKey }) => {
          const active = activeScreen === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveScreen(id)}
              className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[9px] font-bold transition ${
                active ? 'text-amber-700' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                  active ? 'bg-amber-100 ring-1 ring-amber-300/60' : 'bg-transparent'
                }`}
              >
                <Icon size={17} aria-hidden />
              </span>
              <span className="truncate px-0.5 leading-tight">{t(labelKey)}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );

  const deviceShell = framed ? (
    <div
      className={`relative mx-auto w-full max-w-[390px] ${className}`}
      style={{ pointerEvents: 'auto' }}
      dir="ltr"
    >
      {/* Decorative side buttons (device chrome) */}
      <div
        className="pointer-events-none absolute -start-1 top-[22%] z-20 h-9 w-[3px] rounded-s-sm bg-gradient-to-b from-slate-600 to-slate-800 shadow-sm"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -start-1 top-[30%] z-20 h-14 w-[3px] rounded-s-sm bg-gradient-to-b from-slate-600 to-slate-800 shadow-sm"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -end-1 top-[26%] z-20 h-20 w-[3px] rounded-e-sm bg-gradient-to-b from-slate-600 to-slate-800 shadow-sm"
        aria-hidden
      />

      <div
        className="relative mx-auto overflow-visible rounded-[2.85rem] bg-gradient-to-b from-slate-300 via-slate-400 to-slate-700 p-[3px] shadow-[0_32px_64px_-12px_rgba(15,23,42,0.35),0_12px_24px_-8px_rgba(0,0,0,0.2)] ring-1 ring-white/40"
        style={{ pointerEvents: 'auto' }}
      >
        <div
          className="relative flex aspect-[390/780] w-full max-h-[780px] flex-col overflow-hidden rounded-[2.65rem] bg-slate-900 p-[6px]"
          style={{ pointerEvents: 'auto' }}
        >
          {screenBody}
        </div>
      </div>
    </div>
  ) : (
    <div
      className={`mx-auto w-full max-w-[min(390px,calc(100vw-1.5rem))] ${className}`}
      style={{ pointerEvents: 'auto' }}
      dir="ltr"
    >
      <div className="relative flex max-h-[min(780px,88vh)] min-h-[520px] w-full flex-col overflow-hidden rounded-[2.65rem] border border-slate-300/80 bg-gradient-to-b from-slate-300 to-slate-500 p-[6px] shadow-xl">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[2.35rem] bg-slate-900 p-[2px]">{screenBody}</div>
      </div>
    </div>
  );

  return deviceShell;
}

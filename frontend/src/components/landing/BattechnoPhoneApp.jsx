import { useEffect, useMemo, useState } from 'react';
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
import battechnoLogo from '../../assets/images/batman-logo.png';

/** @typedef {'home' | 'credentials' | 'partners' | 'account'} PhoneScreen */

/**
 * Interactive iPhone-style LMS preview (real JSX).
 * @param {{ variant?: 'device' | 'standalone', className?: string }} props
 */
export function BattechnoPhoneApp({ variant = 'device', className = '' }) {
  const { t, i18n } = useTranslation('landing');
  const { dir } = useLocale();
  const [activeScreen, setActiveScreen] = useState(/** @type {PhoneScreen} */ ('home'));
  const [now, setNow] = useState(() => new Date());

  const framed = variant === 'device';

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const statusClock = useMemo(() => {
    const locale = i18n.language?.startsWith('ar') ? 'ar' : i18n.language || 'en-US';
    const time = now.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
    const date = now.toLocaleDateString(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    return { time, date };
  }, [now, i18n.language]);

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
      { titleKey: 'phone.credentials.card1Title', statusKey: 'phone.credentials.statusPublished', tone: 'success' },
      { titleKey: 'phone.credentials.card2Title', statusKey: 'phone.credentials.statusReview', tone: 'accent' },
      { titleKey: 'phone.credentials.card3Title', statusKey: 'phone.credentials.statusDraft', tone: 'neutral' },
    ],
    []
  );

  const credentialToneClass = (tone) => {
    if (tone === 'success') return 'bg-bat-primary/10 text-bat-primary';
    if (tone === 'accent') return 'bg-bat-accent-soft text-bat-primary';
    return 'bg-bat-surface-header text-bat-muted';
  };

  const screenBody = (
    <div
      className="relative z-10 flex min-h-0 h-full w-full flex-1 flex-col overflow-hidden rounded-none bg-bat-bg text-bat-text shadow-inner"
      dir={dir}
    >
      <div
        className={`pointer-events-none absolute start-3 top-2.5 z-40 flex flex-col ${framed ? 'max-w-[38%]' : ''}`}
        aria-hidden
      >
        <span className="text-[11px] font-semibold tabular-nums leading-none tracking-tight text-bat-ink">
          {statusClock.time}
        </span>
        <span className="mt-0.5 text-[9px] font-medium leading-tight text-bat-muted">{statusClock.date}</span>
      </div>

      {framed ? (
        <div
          className="pointer-events-none absolute left-1/2 top-3 z-30 h-[1.35rem] w-[5.5rem] -translate-x-1/2 rounded-full bg-black shadow-md ring-1 ring-black/40"
          aria-hidden
        />
      ) : null}

      <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-bat-border/90 bg-bat-surface/90 px-4 pb-2.5 pt-9 backdrop-blur-sm">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <img
            src={battechnoLogo}
            alt={t('brand')}
            className="h-7 w-auto max-w-full object-contain object-start"
            decoding="async"
          />
          <p className="truncate text-[10px] font-medium text-bat-muted">{t('phone.previewBadge')}</p>
        </div>
        <FiChevronRight className={`shrink-0 text-bat-muted ${dir === 'rtl' ? 'rotate-180' : ''}`} aria-hidden />
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
                  <p className="text-[11px] font-semibold text-bat-muted">{t('phone.home.greeting')}</p>
                  <p className="text-lg font-black leading-tight text-bat-ink">{t('phone.home.platform')}</p>
                  <p className="mt-0.5 text-[11px] text-bat-text">{t('phone.home.tagline')}</p>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { l: 'phone.home.statMicro', v: 'phone.home.statMicroVal' },
                    { l: 'phone.home.statUniv', v: 'phone.home.statUnivVal' },
                    { l: 'phone.home.statCohort', v: 'phone.home.statCohortVal' },
                  ].map(({ l, v }) => (
                    <div
                      key={l}
                      className="rounded-xl border border-bat-border/80 bg-bat-surface px-1.5 py-2 text-center shadow-sm"
                    >
                      <p className="text-base font-bold tabular-nums text-bat-ink">{t(v)}</p>
                      <p className="mt-0.5 text-[9px] font-semibold leading-tight text-bat-text">{t(l)}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Link
                    to="/register"
                    className="flex min-h-[2.75rem] items-center justify-center rounded-xl bg-bat-primary text-center text-[11px] font-semibold text-white shadow-sm"
                  >
                    {t('hero.ctaRegister')}
                  </Link>
                  <Link
                    to="/login"
                    className="flex min-h-[2.75rem] items-center justify-center rounded-xl border border-bat-accent bg-bat-accent-soft text-center text-[11px] font-bold text-bat-primary shadow-sm"
                  >
                    {t('hero.ctaLogin')}
                  </Link>
                </div>
              </div>
            ) : null}

            {activeScreen === 'credentials' ? (
              <div className="space-y-2.5">
                <div>
                  <p className="text-sm font-bold text-bat-ink">{t('phone.credentials.title')}</p>
                  <p className="text-[10px] text-bat-muted">{t('phone.credentials.subtitle')}</p>
                </div>
                {credentialSamples.map((c) => (
                  <div
                    key={c.titleKey}
                    className="rounded-xl border border-bat-border bg-bat-surface p-2.5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 text-[11px] font-bold leading-snug text-bat-ink">{t(c.titleKey)}</p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${credentialToneClass(c.tone)}`}
                      >
                        {t(c.statusKey)}
                      </span>
                    </div>
                  </div>
                ))}
                <Link
                  to="/register"
                  className="mt-1 flex min-h-[2.5rem] w-full items-center justify-center rounded-xl border border-bat-border bg-bat-surface text-[11px] font-semibold text-bat-ink shadow-sm"
                >
                  {t('phone.credentials.exploreCta')}
                </Link>
              </div>
            ) : null}

            {activeScreen === 'partners' ? (
              <div className="space-y-2">
                <div>
                  <p className="text-sm font-bold text-bat-ink">{t('phone.partners.title')}</p>
                  <p className="text-[10px] text-bat-muted">{t('phone.partners.subtitle')}</p>
                </div>
                <ul className="space-y-1.5">
                  {PARTNER_INSTITUTIONS.map((p) => (
                    <li
                      key={p.id}
                      className="group/row flex items-center gap-2 rounded-xl border border-bat-border bg-bat-surface px-2.5 py-2 shadow-sm"
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-bat-border/90 bg-bat-bg">
                        <img
                          src={p.logoUrl}
                          alt={t(p.nameKey)}
                          className="max-h-9 max-w-[2.35rem] object-contain"
                          loading="lazy"
                          decoding="async"
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-bold text-bat-ink">{t(p.nameKey)}</p>
                        <span className="mt-0.5 inline-block rounded-md bg-bat-surface-header px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-bat-muted">
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
                  <p className="text-sm font-bold text-bat-ink">{t('phone.account.title')}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-bat-text">{t('phone.account.intro')}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    to="/register"
                    className="flex min-h-[2.65rem] items-center justify-center rounded-xl bg-bat-primary text-[11px] font-semibold text-white shadow-sm"
                  >
                    {t('hero.ctaRegister')}
                  </Link>
                  <Link
                    to="/login"
                    className="flex min-h-[2.65rem] items-center justify-center rounded-xl border border-bat-accent bg-bat-accent-soft text-[11px] font-bold text-bat-primary"
                  >
                    {t('hero.ctaLogin')}
                  </Link>
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-bat-muted">{t('features.subtitle')}</p>
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
                      className="flex min-h-[2.4rem] items-center justify-center rounded-lg border border-bat-border bg-bat-surface text-center text-[10px] font-semibold text-bat-ink transition hover:border-bat-accent/50 hover:bg-bat-surface-light"
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
        className="relative z-10 flex shrink-0 items-stretch justify-around gap-0.5 border-t border-bat-border/90 bg-bat-surface/95 px-1 py-1.5 backdrop-blur-md"
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
                active ? 'text-bat-primary' : 'text-bat-muted hover:text-bat-primary'
              }`}
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                  active ? 'bg-bat-accent-soft ring-1 ring-bat-accent/50' : 'bg-transparent'
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
      <div
        className="pointer-events-none absolute -start-1 top-[22%] z-20 h-9 w-[3px] rounded-s-sm bg-gradient-to-b from-zinc-800 to-black shadow-sm"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -start-1 top-[30%] z-20 h-14 w-[3px] rounded-s-sm bg-gradient-to-b from-zinc-800 to-black shadow-sm"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -end-1 top-[26%] z-20 h-20 w-[3px] rounded-e-sm bg-gradient-to-b from-zinc-800 to-black shadow-sm"
        aria-hidden
      />

      <div
        className="relative mx-auto overflow-visible rounded-[2.85rem] bg-gradient-to-b from-zinc-800 via-neutral-900 to-black p-[3px] shadow-[0_28px_56px_-18px_rgba(0,0,0,0.45),0_12px_28px_-10px_rgba(0,0,0,0.35)] ring-1 ring-white/12"
        style={{ pointerEvents: 'auto' }}
      >
        <div
          className="relative flex aspect-[390/780] w-full max-h-[780px] flex-col overflow-hidden rounded-[calc(2.85rem-3px)] bg-bat-bg ring-1 ring-inset ring-black/30"
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
      <div className="relative flex max-h-[min(780px,88vh)] min-h-[520px] w-full flex-col overflow-hidden rounded-[2.65rem] border border-zinc-700/80 bg-gradient-to-b from-zinc-800 via-neutral-900 to-black p-[3px] shadow-xl shadow-black/40">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[calc(2.65rem-3px)] bg-bat-bg ring-1 ring-inset ring-black/35">
          {screenBody}
        </div>
      </div>
    </div>
  );

  return deviceShell;
}

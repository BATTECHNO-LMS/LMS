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
import { BrandLogo } from '../common/BrandLogo.jsx';
import { PhoneHomeDashboard } from './PhoneHomeDashboard.jsx';
import { PhoneDeviceFrame } from './PhoneDeviceFrame.jsx';
import { useLandingMotion } from './motion/index.js';

/** @typedef {'home' | 'credentials' | 'partners' | 'account'} PhoneScreen */

/**
 * Interactive iPhone-style LMS preview (real JSX).
 * @param {{ variant?: 'device' | 'standalone', className?: string }} props
 */
export function BattechnoPhoneApp({ variant = 'device', className = '' }) {
  const { t, i18n } = useTranslation('landing');
  const { dir } = useLocale();
  const { reduced, transition } = useLandingMotion();
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
      className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-bat-bg text-bat-text"
      dir={dir}
    >
      {/* Status bar — below Dynamic Island safe zone */}
      <div
        className={`pointer-events-none absolute start-3.5 z-40 flex flex-col ${
          framed ? 'top-[2.55rem]' : 'top-2.5'
        } ${framed ? 'max-w-[34%]' : ''}`}
        aria-hidden
      >
        <span className="text-[10px] font-semibold tabular-nums leading-none tracking-tight text-bat-ink">
          {statusClock.time}
        </span>
        <span className="mt-0.5 text-[8px] font-medium leading-tight text-bat-muted">{statusClock.date}</span>
      </div>

      <header
        className={`relative z-10 flex shrink-0 items-center justify-between border-b border-bat-border/90 bg-bat-surface/95 px-3 backdrop-blur-sm ${
          framed ? 'pb-2 pt-[3.4rem]' : 'pb-2.5 pt-9'
        }`}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <BrandLogo variant="phone" alt={t('brand')} />
          <p className="truncate text-[9px] font-medium text-bat-muted">{t('phone.previewBadge')}</p>
        </div>
        <FiChevronRight className={`shrink-0 text-bat-muted ${dir === 'rtl' ? 'rotate-180' : ''}`} aria-hidden />
      </header>

      <div className="relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain px-2.5 pb-2 pt-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeScreen}
            initial={reduced ? false : { opacity: 0, x: dir === 'rtl' ? -6 : 6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduced ? undefined : { opacity: 0, x: dir === 'rtl' ? 6 : -6 }}
            transition={transition(0.22)}
            className="space-y-2.5"
          >
            {activeScreen === 'home' ? <PhoneHomeDashboard /> : null}

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
                      className="flex items-center gap-2 rounded-xl border border-bat-border bg-bat-surface px-2.5 py-2 shadow-sm"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-bat-border/90 bg-bat-bg">
                        <img
                          src={p.logoUrl}
                          alt={t(p.nameKey)}
                          className="max-h-8 max-w-[2rem] object-contain"
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
              className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[9px] font-bold transition-colors ${
                active ? 'text-bat-primary' : 'text-bat-muted hover:text-bat-primary'
              }`}
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-xl sm:h-8 sm:w-8 ${
                  active ? 'bg-bat-accent-soft ring-1 ring-bat-accent/50' : 'bg-transparent'
                }`}
              >
                <Icon size={16} aria-hidden />
              </span>
              <span className="truncate px-0.5 leading-tight">{t(labelKey)}</span>
            </button>
          );
        })}
      </nav>

      {/* Home indicator */}
      {framed ? (
        <div className="pointer-events-none flex shrink-0 justify-center pb-1 pt-0.5" aria-hidden>
          <span className="h-[3px] w-[26%] min-w-[3.5rem] max-w-[4.25rem] rounded-full bg-bat-ink/18" />
        </div>
      ) : null}
    </div>
  );

  if (framed) {
    return (
      <PhoneDeviceFrame className={className}>
        {screenBody}
      </PhoneDeviceFrame>
    );
  }

  return (
    <PhoneDeviceFrame className={className}>
      {screenBody}
    </PhoneDeviceFrame>
  );
}

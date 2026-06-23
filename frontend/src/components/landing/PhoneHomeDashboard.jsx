import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useLandingStatsContext } from '../../features/landing/LandingStatsContext.jsx';
import { useLandingMotion, useCountUp, useInViewOnce, MOTION_STAGGER } from './motion/index.js';

function PhoneStatCard({ label, value, suffix = '', chipKey, variants, isLoading }) {
  const { t } = useTranslation('landing');
  const ref = useRef(null);
  const inView = useInViewOnce(ref);
  const numeric = value == null ? null : Number(value);
  const animated = useCountUp(numeric ?? 0, { enabled: inView && !isLoading && numeric != null });
  const display =
    isLoading || numeric == null ? '—' : suffix ? `${animated}${suffix}` : String(animated);

  return (
    <motion.div
      ref={ref}
      variants={variants}
      className="rounded-lg border border-bat-border/80 bg-bat-surface px-1 py-1.5 text-center shadow-sm"
    >
      <p className="text-sm font-bold tabular-nums text-bat-ink">{display}</p>
      <p className="mt-0.5 text-[8px] font-semibold leading-tight text-bat-muted">{label}</p>
      {chipKey ? (
        <span className="mt-1 inline-block rounded-md bg-bat-accent-soft px-1 py-0.5 text-[7px] font-bold text-bat-primary">
          {t(chipKey)}
        </span>
      ) : null}
    </motion.div>
  );
}

function PhoneProgressRow({ titleKey, pct, delay = 0, isLoading = false }) {
  const { t } = useTranslation('landing');
  const { reduced, transition } = useLandingMotion();
  const safePct = isLoading || pct == null ? 0 : Math.max(0, Math.min(100, Number(pct) || 0));
  const displayPct = useCountUp(safePct, { enabled: !isLoading && pct != null });
  const display = isLoading || pct == null ? '—' : `${displayPct}%`;

  return (
    <motion.li
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transition(0.45, delay)}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-[9px] font-semibold text-bat-text">{t(titleKey)}</span>
        <span className="shrink-0 text-[9px] font-bold tabular-nums text-bat-primary">{display}</span>
      </div>
      <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-bat-surface-header">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-bat-accent to-bat-accent-hover"
          initial={reduced ? false : { scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={transition(0.8, delay + 0.1)}
          style={{
            width: isLoading ? '0%' : `${safePct}%`,
            transformOrigin: 'right center',
          }}
        />
      </div>
    </motion.li>
  );
}

export function PhoneHomeDashboard() {
  const { t } = useTranslation('landing');
  const { stats, isLoading } = useLandingStatsContext();
  const { staggerContainer, staggerItem, transition, reduced } = useLandingMotion();

  const statsGrid = [
    {
      l: 'phone.home.statMicro',
      value: stats?.microCredentialsCount,
      chip: 'phone.home.chipActive',
    },
    {
      l: 'phone.home.statUniv',
      value: stats?.universitiesCount,
      chip: null,
    },
    {
      l: 'phone.home.statCohort',
      value: stats?.cohortsCount,
      chip: 'phone.home.chipActive',
    },
    {
      l: 'phone.home.statCerts',
      value: stats?.certificatesCount,
      chip: 'phone.home.chipComplete',
    },
    {
      l: 'phone.home.statAttendance',
      value: stats?.attendanceRate,
      suffix: '%',
      chip: null,
    },
    {
      l: 'phone.home.statAssessments',
      value: stats?.assessmentsCount,
      chip: 'phone.home.chipReview',
    },
  ];

  const programProgress = [
    stats?.activePrograms?.[0]?.progress ?? null,
    stats?.activePrograms?.[1]?.progress ?? null,
  ];

  const rowValues = [
    {
      labelKey: 'phone.home.rowAttendance',
      value: isLoading || stats == null ? '—' : t('phone.home.rowAttendanceVal', { count: stats.sessionsThisWeekCount }),
      tone: 'accent',
    },
    {
      labelKey: 'phone.home.rowAssessments',
      value: isLoading || stats == null ? '—' : t('phone.home.rowAssessmentsVal', { count: stats.openAssessmentsCount }),
      tone: 'primary',
    },
    {
      labelKey: 'phone.home.rowCerts',
      value: isLoading || stats == null ? '—' : t('phone.home.rowCertsVal', { count: stats.issuedCertificatesCount }),
      tone: 'success',
    },
  ];

  return (
    <motion.div
      variants={staggerContainer(MOTION_STAGGER.tight, 0.05)}
      initial="hidden"
      animate="show"
      className="space-y-2.5"
    >
      <motion.div
        variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
        transition={transition(0.4)}
        className="rounded-xl border border-bat-border/80 bg-bat-surface px-2.5 py-2 shadow-sm"
      >
        <p className="text-[9px] font-semibold uppercase tracking-wide text-bat-muted">
          {t('phone.home.dashboardTitle')}
        </p>
        <p className="text-sm font-black leading-tight text-bat-ink">{t('phone.home.platform')}</p>
        <p className="mt-0.5 text-[10px] text-bat-text">{t('phone.home.tagline')}</p>
      </motion.div>

      <motion.div
        variants={staggerContainer(MOTION_STAGGER.tight, 0.08)}
        initial="hidden"
        animate="show"
        className="grid grid-cols-3 gap-1.5"
      >
        {statsGrid.map(({ l, value, suffix, chip }) => (
          <PhoneStatCard
            key={l}
            label={t(l)}
            value={value}
            suffix={suffix}
            chipKey={chip}
            variants={staggerItem(8)}
            isLoading={isLoading}
          />
        ))}
      </motion.div>

      <motion.div
        variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
        transition={transition(0.45, 0.2)}
        className="rounded-xl border border-bat-border/80 bg-bat-surface p-2 shadow-sm"
      >
        <p className="text-[10px] font-bold text-bat-ink">{t('phone.home.activePrograms')}</p>
        <ul className="mt-1.5 space-y-1.5">
          <PhoneProgressRow
            titleKey="phone.home.program1"
            pct={programProgress[0]}
            delay={0.25}
            isLoading={isLoading}
          />
          <PhoneProgressRow
            titleKey="phone.home.program2"
            pct={programProgress[1]}
            delay={0.32}
            isLoading={isLoading}
          />
        </ul>
      </motion.div>

      <motion.ul variants={staggerContainer(MOTION_STAGGER.tight, 0.28)} className="space-y-1">
        {rowValues.map(({ labelKey, value, tone }) => (
          <motion.li
            key={labelKey}
            variants={{ hidden: { opacity: 0, x: reduced ? 0 : 6 }, show: { opacity: 1, x: 0 } }}
            transition={transition(0.35)}
            className="flex items-center justify-between gap-2 rounded-lg border border-bat-border/70 bg-bat-bg px-2 py-1.5"
          >
            <span className="text-[9px] font-medium text-bat-text">{t(labelKey)}</span>
            <span
              className={`shrink-0 rounded-md px-1.5 py-0.5 text-[8px] font-bold ${
                tone === 'success'
                  ? 'bg-bat-primary/10 text-bat-primary'
                  : tone === 'accent'
                    ? 'bg-bat-accent-soft text-bat-primary'
                    : 'bg-bat-surface-header text-bat-muted'
              }`}
            >
              {value}
            </span>
          </motion.li>
        ))}
      </motion.ul>

      <motion.div
        variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }}
        transition={transition(0.4, 0.38)}
        className="grid grid-cols-2 gap-1.5 pt-0.5"
      >
        <Link
          to="/login"
          className="flex min-h-[2.5rem] items-center justify-center rounded-xl bg-bat-primary text-center text-[10px] font-semibold text-white shadow-sm transition hover:bg-bat-primary-hover"
        >
          {t('hero.ctaLogin')}
        </Link>
        <Link
          to="/register"
          className="flex min-h-[2.5rem] items-center justify-center rounded-xl border border-bat-accent bg-bat-accent-soft text-center text-[10px] font-bold text-bat-primary shadow-sm transition hover:bg-bat-accent"
        >
          {t('hero.ctaRegister')}
        </Link>
      </motion.div>
    </motion.div>
  );
}

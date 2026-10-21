const NAV_PILLS = [
  { href: '#configure', label: 'ابدأ الآن' },
  { href: '#recommended-track', label: 'مسارك' },
  { href: '#evaluation', label: 'التقييم' },
  { href: '#enrollment', label: 'الالتحاق' },
];

const HERO_STATS = [
  { value: '04', label: 'مسارات تخصصية' },
  { value: '80–300', label: 'ساعة تدريب' },
  { value: 'RTL', label: 'تجربة عربية أولاً' },
];

export function JourneyHeader({ logoSrc }) {
  return (
    <header className="ij-header">
      <div className="ij-brand">
        <img src={logoSrc} alt="شعار eprojecto / BATMAN TECHNOLOGY" width="146" height="63" decoding="async" />
        <div className="ij-brand-meta">
          FIELD TRAINING
          <br />
          JOURNEY 2026
        </div>
      </div>
      <nav className="ij-navpills" aria-label="أقسام رحلة التدريب">
        {NAV_PILLS.map((pill) => (
          <a key={pill.href} href={pill.href}>
            {pill.label}
          </a>
        ))}
      </nav>
      <span className="ij-tag">eprojecto</span>
    </header>
  );
}

export function JourneyHero({ logoSrc }) {
  return (
    <div className="ij-hero">
      <div>
        <span className="ij-tag">تدريب ميداني جامعي</span>
        <h1>
          ابدأ تدريبك الميداني
          <br />
          <span className="ij-gradient-text">بمسار مصمم لتخصصك</span>
        </h1>
        <p>
          حدد جامعتك وتخصصك وعدد ساعات التدريب المطلوبة، وسنجهز لك المسار التدريبي الأنسب قبل الالتحاق.
        </p>
        <a className="ij-btn ij-hero-cta" href="#configure">
          ابدأ الآن
        </a>
        <div className="ij-stats">
          {HERO_STATS.map((stat) => (
            <div key={stat.label} className="ij-stat">
              <b>{stat.value}</b>
              <span>{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="ij-hero-art">
        <div className="ij-planet" aria-hidden="true" />
        <img
          className="ij-astronaut ij-hero-logo"
          src={logoSrc}
          alt="شعار BATMAN TECHNOLOGY"
          width="220"
          height="95"
          decoding="async"
        />
        <span className="ij-orbit-icon ij-orbit-icon--1" aria-hidden="true">
          📊
        </span>
        <span className="ij-orbit-icon ij-orbit-icon--2" aria-hidden="true">
          📣
        </span>
        <span className="ij-orbit-icon ij-orbit-icon--3" aria-hidden="true">
          💹
        </span>
      </div>
      <div className="ij-orb ij-orb--a" aria-hidden="true" />
      <div className="ij-orb ij-orb--b" aria-hidden="true" />
      <div className="ij-orb ij-orb--c" aria-hidden="true" />
    </div>
  );
}

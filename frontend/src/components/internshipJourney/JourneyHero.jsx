import { BatmanCharacter } from './BatmanCharacter.jsx';

const NAV_PILLS = [
  { href: '#configure', label: 'ابدأ رحلتك' },
  { href: '#evaluation', label: 'آلية التقييم' },
  { href: '#enrollment', label: 'آلية الالتحاق' },
];

const HERO_STATS = [
  { value: '04', label: 'تخصصات مهنية' },
  { value: '75%', label: 'من الساعات للتخصص' },
  { value: '80+', label: 'علامة التأهل الداخلية' },
];

export function JourneyHeader({ logoSrc }) {
  return (
    <header className="ij-header">
      <div className="ij-brand">
        <img src={logoSrc} alt="شعار BATMAN TECHNOLOGY" width="146" height="63" decoding="async" />
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
      <span className="ij-tag">✨ EPROJECTO INSPIRED</span>
    </header>
  );
}

export function JourneyHero() {
  return (
    <div className="ij-hero">
      <div>
        <span className="ij-tag">🎓 BATMAN TECHNOLOGY • UNIVERSITY INTERNSHIP</span>
        <h1>
          مستقبلك المهني
          <br />
          <span className="ij-gradient-text">يبدأ برحلة!</span> 🛸
        </h1>
        <p>
          اختار جامعتك، ساعات تدريبك وتخصصك... وراح نرسم لك طريق واضح، فيه مهام ومشاريع وتقييم حقيقي. مش
          عشرات الكورسات؛ تجربة تحضّرك لسوق العمل.
        </p>
        <a className="ij-btn ij-hero-cta" href="#configure">
          يلا نبدأ المغامرة ✨
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
        <BatmanCharacter />
        <span className="ij-orbit-icon ij-orbit-icon--1" aria-hidden="true">
          💻
        </span>
        <span className="ij-orbit-icon ij-orbit-icon--2" aria-hidden="true">
          🎯
        </span>
        <span className="ij-orbit-icon ij-orbit-icon--3" aria-hidden="true">
          🚀
        </span>
      </div>
      <div className="ij-orb ij-orb--a" aria-hidden="true" />
      <div className="ij-orb ij-orb--b" aria-hidden="true" />
      <div className="ij-orb ij-orb--c" aria-hidden="true" />
    </div>
  );
}

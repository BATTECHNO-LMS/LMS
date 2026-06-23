/**
 * Branded ambient background for auth pages — decorative only, no interaction.
 */
export function AuthBackgroundDecor() {
  return (
    <div className="auth-bg" aria-hidden>
      <div className="auth-bg__gradient" />
      <div className="auth-bg__grid" />
      <div className="auth-bg__dot-field" />
      <div className="auth-bg__radial auth-bg__radial--gold" />
      <div className="auth-bg__radial auth-bg__radial--navy" />
      <div className="auth-bg__radial auth-bg__radial--center" />

      <div className="auth-bg__blob auth-bg__blob--1" />
      <div className="auth-bg__blob auth-bg__blob--2" />
      <div className="auth-bg__blob auth-bg__blob--3" />

      <svg className="auth-bg__orbit auth-bg__orbit--tl" viewBox="0 0 200 200" fill="none">
        <circle cx="100" cy="100" r="72" stroke="currentColor" strokeWidth="1" strokeDasharray="4 8" opacity="0.35" />
        <path d="M28 100 A72 72 0 0 1 100 28" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>

      <svg className="auth-bg__orbit auth-bg__orbit--br" viewBox="0 0 240 240" fill="none">
        <ellipse cx="120" cy="120" rx="90" ry="60" stroke="currentColor" strokeWidth="1" strokeDasharray="3 7" opacity="0.3" />
        <path d="M30 120 Q120 40 210 120" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      </svg>

      <svg className="auth-bg__connector auth-bg__connector--top" viewBox="0 0 400 80" preserveAspectRatio="none" fill="none">
        <path
          d="M0 60 C80 20 160 70 240 40 S360 10 400 50"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="6 10"
          opacity="0.25"
        />
      </svg>

      <div className="auth-bg__icon auth-bg__icon--tl">
        <AuthDecorShield />
      </div>
      <div className="auth-bg__icon auth-bg__icon--tr">
        <AuthDecorCertificate />
      </div>
      <div className="auth-bg__icon auth-bg__icon--bl auth-bg__icon--hide-mobile">
        <AuthDecorGraduation />
      </div>
      <div className="auth-bg__icon auth-bg__icon--br auth-bg__icon--hide-mobile">
        <AuthDecorChart />
      </div>

      <div className="auth-bg__icon auth-bg__icon--mid auth-bg__icon--hide-tablet">
        <AuthDecorQuality />
      </div>

      <ul className="auth-bg__particles">
        {PARTICLE_OFFSETS.map((p) => (
          <li
            key={p.id}
            className="auth-bg__particle"
            style={{
              '--auth-p-x': p.x,
              '--auth-p-y': p.y,
              '--auth-p-delay': p.delay,
              '--auth-p-duration': p.duration,
            }}
          />
        ))}
      </ul>
    </div>
  );
}

const PARTICLE_OFFSETS = [
  { id: 1, x: '12%', y: '22%', delay: '0s', duration: '14s' },
  { id: 2, x: '88%', y: '18%', delay: '-2s', duration: '16s' },
  { id: 3, x: '78%', y: '72%', delay: '-4s', duration: '12s' },
  { id: 4, x: '18%', y: '78%', delay: '-1s', duration: '18s' },
  { id: 5, x: '52%', y: '12%', delay: '-3s', duration: '15s' },
  { id: 6, x: '6%', y: '48%', delay: '-5s', duration: '17s' },
];

function AuthDecorShield() {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden>
      <path
        d="M24 4L8 10v11c0 9.5 6.8 18.3 16 21 9.2-2.7 16-11.5 16-21V10L24 4Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M17 24l4 4 10-10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AuthDecorCertificate() {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden>
      <rect x="10" y="8" width="28" height="32" rx="3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M16 18h16M16 24h12M16 30h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="36" cy="36" r="6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M33.5 36l1.8 1.8L39 34" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AuthDecorGraduation() {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden>
      <path d="M6 20 24 12l18 8-18 8-18-8Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M38 22v10c0 0-6 6-14 6s-14-6-14-6V22" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M42 18v14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function AuthDecorChart() {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden>
      <rect x="8" y="10" width="32" height="28" rx="3" stroke="currentColor" strokeWidth="1.3" />
      <path d="M14 30V22M22 30V18M30 30V14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 34h24" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

function AuthDecorQuality() {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden>
      <circle cx="24" cy="24" r="14" stroke="currentColor" strokeWidth="1.3" strokeDasharray="3 5" />
      <path d="M24 14v10l7 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 32h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}

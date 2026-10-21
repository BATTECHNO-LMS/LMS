import { OUTCOME_CARDS } from '../../features/internshipJourney/index.js';

const TRACK_ICON = {
  systems: '📊',
  campaign: '📣',
  finance: '💹',
  operations: '🧭',
};

export function TrackPreview({ plan, onEnroll, onDownloadPdf, pdfBusy = false, pdfError = null }) {
  if (!plan) return null;
  const icon = TRACK_ICON[plan.track.icon] || '✨';

  return (
    <section className="ij-section ij-track-preview" id="recommended-track" aria-live="polite">
      <div className="ij-section-title">
        <div className="ij-eyebrow">02 / YOUR TRACK</div>
        <h2>مسارك التدريبي المقترح</h2>
        <p>مبني على جامعتك وتخصصك وعدد ساعات التدريب التي حددتها.</p>
      </div>

      <article className="ij-glass ij-track-card">
        <header className="ij-track-card__head">
          <span className="ij-track-card__icon" aria-hidden="true">
            {icon}
          </span>
          <div>
            <p className="ij-track-card__eyebrow">{plan.intensity?.labelAr}</p>
            <h3>{plan.track.nameAr}</h3>
            <p className="ij-track-card__en" lang="en" dir="ltr">
              {plan.track.nameEn}
            </p>
            {!plan.trackConfigured ? (
              <p className="ij-track-pending">سيتم تجهيز المسار التدريبي المناسب لهذا التخصص.</p>
            ) : null}
          </div>
        </header>

        <dl className="ij-track-meta">
          <div>
            <dt>الجامعة</dt>
            <dd>{plan.universityName}</dd>
          </div>
          <div>
            <dt>الكلية</dt>
            <dd>{plan.facultyName}</dd>
          </div>
          <div>
            <dt>التخصص</dt>
            <dd>{plan.majorLabelAr}</dd>
          </div>
          <div>
            <dt>ساعات التدريب</dt>
            <dd>
              {plan.trainingHours} <span className="ij-unit">ساعة</span>
            </dd>
          </div>
        </dl>

        <div className="ij-track-block">
          <h4>هيكل التدريب التقديري</h4>
          <ul className="ij-structure-list">
            {plan.structureSummary.map((row) => (
              <li key={row.key}>
                <span>{row.label}</span>
                <strong>
                  {row.hours} ساعة
                </strong>
              </li>
            ))}
          </ul>
        </div>

        <div className="ij-track-block">
          <h4>المحاور الرئيسية</h4>
          <ul className="ij-skill-list">
            {plan.track.skills.map((skill) => (
              <li key={skill} lang="en" dir="ltr">
                {skill}
              </li>
            ))}
          </ul>
        </div>

        <div className="ij-track-block">
          <h4>يتضمن</h4>
          <p className="ij-includes">
            Professional Foundation · Specialized Training · Practical Tasks · Final Project · Portfolio
          </p>
          <p className="ij-final-project">
            <strong>المشروع النهائي:</strong> <span lang="en" dir="ltr">{plan.track.finalProject}</span>
          </p>
        </div>

        <div className="ij-track-cta">
          <button type="button" className="ij-btn ij-pulse" onClick={onEnroll}>
            ابدأ التسجيل في التدريب
          </button>
          {typeof onDownloadPdf === 'function' ? (
            <button
              type="button"
              className="ij-btn ij-btn--secondary ij-btn--pdf"
              onClick={onDownloadPdf}
              disabled={pdfBusy}
              aria-busy={pdfBusy || undefined}
            >
              {pdfBusy ? 'جاري تجهيز ملف PDF…' : 'حفظ الخطة PDF'}
            </button>
          ) : null}
        </div>
        {pdfError ? (
          <p className="ij-pdf-error" role="alert">
            {pdfError}
          </p>
        ) : null}
      </article>

      <div className="ij-outcomes">
        <h3 className="ij-outcomes__title">ماذا ستحصل عليه؟</h3>
        <div className="ij-outcomes__grid">
          {OUTCOME_CARDS.map((card) => (
            <article key={card.title} className="ij-outcome">
              <span aria-hidden="true">{card.icon}</span>
              <h4>{card.title}</h4>
              <p>{card.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

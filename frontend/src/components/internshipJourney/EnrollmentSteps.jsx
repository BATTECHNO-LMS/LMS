import {
  COMPANY_MAP_URL,
  ENROLLMENT_PHONES,
  buildEnrollmentWhatsAppMessage,
  emitInternshipJourneyEvent,
  phoneHref,
  whatsappHref,
} from '../../features/internshipJourney/index.js';
import { useRevealOnScroll } from './useRevealOnScroll.js';

const STEPS = [
  {
    icon: '🎯',
    index: 'STEP 01',
    title: 'تحديد المسار',
    body: 'أكمل ملفك الأكاديمي واطّلع على المسار المقترح لساعاتك وتخصصك.',
  },
  {
    icon: '📞',
    index: 'STEP 02',
    title: 'الالتحاق',
    body: 'تواصل معنا وأرسل بيانات جامعتك وتخصصك وعدد الساعات — بدون إعادة إدخالها يدوياً إن أمكن.',
  },
  {
    icon: '📄',
    index: 'STEP 03',
    title: 'كتاب الالتحاق',
    body: (
      <>
        راجع جامعتك واطلب <strong>كتاب الالتحاق بالتدريب الميداني</strong> الرسمي الموجّه للشركة.
      </>
    ),
  },
  {
    icon: '🏢',
    index: 'STEP 04',
    title: 'البدء في الشركة',
    body: 'أحضر الكتاب إلى مقر BATMAN TECHNOLOGY في عمّان لاستكمال الإجراءات وتنسيق الجدول.',
  },
];

function InternshipContactActions({ profile }) {
  const message = buildEnrollmentWhatsAppMessage(profile);
  const wa = whatsappHref(undefined, message);

  function onRegisterClick() {
    emitInternshipJourneyEvent('registration_started', {
      majorCode: profile?.majorCode,
      trackCode: profile?.trackCode,
      hours: profile?.trainingHours,
      hasUniversityId: Boolean(profile?.universityId),
    });
  }

  return (
    <div className="ij-enroll-actions">
      {ENROLLMENT_PHONES.map((phone) => (
        <a
          key={phone.display}
          className="ij-call"
          href={phoneHref(phone.international)}
          aria-label={`اتصل على ${phone.display}`}
          onClick={onRegisterClick}
        >
          📞 {phone.display}
        </a>
      ))}
      <a
        className="ij-wa"
        target="_blank"
        rel="noopener noreferrer"
        href={wa}
        onClick={onRegisterClick}
      >
        💬 واتساب التسجيل
      </a>
      <a className="ij-location" target="_blank" rel="noopener noreferrer" href={COMPANY_MAP_URL}>
        📍 افتح موقع الشركة على الخريطة ↗
      </a>
    </div>
  );
}

export function EnrollmentSteps({ profile = null }) {
  const [ref, revealed] = useRevealOnScroll();
  return (
    <section ref={ref} id="enrollment" className={`ij-section ij-reveal${revealed ? ' ij-in' : ''}`}>
      <div className="ij-section-title">
        <div className="ij-eyebrow">05 / JOIN THE JOURNEY</div>
        <h2>كيف تلتحق بالتدريب الميداني؟</h2>
        <p>خطوات واضحة من تحديد المسار حتى بدء التدريب في الشركة</p>
      </div>
      <div className="ij-glass ij-enroll-panel">
        {profile ? (
          <div className="ij-enroll-profile" role="status">
            <strong>ملفك الأكاديمي جاهز للتسجيل:</strong>{' '}
            {profile.universityName} · {profile.facultyName} · {profile.majorLabelAr} · {profile.trainingHours} ساعة
          </div>
        ) : null}
        <div className="ij-enroll-steps ij-enroll-steps--4">
          {STEPS.map((step) => (
            <article key={step.index} className="ij-enroll-step">
              <span className="ij-step-icon" aria-hidden="true">
                {step.icon}
              </span>
              <span className="ij-step-index">{step.index}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
        <InternshipContactActions profile={profile} />
        <div className="ij-enroll-reminder">
          💡 <strong>تذكير:</strong> كتاب الالتحاق من الجامعة مطلوب لإتمام إجراءات التدريب في الشركة. ساعات التدريب
          وأوقات الدوام تُنسّق وفق شروط الجامعة وبعد تأكيد القبول من الشركة.
        </div>
      </div>
    </section>
  );
}

import {
  COMPANY_MAP_URL,
  ENROLLMENT_PHONES,
  phoneHref,
  whatsappHref,
} from '../../features/internshipJourney/index.js';
import { useRevealOnScroll } from './useRevealOnScroll.js';

const STEPS = [
  {
    icon: '📞',
    index: 'STEP 01',
    title: 'تواصل معنا',
    body: 'احكِ معنا على أحد الرقمين، واذكر اسم جامعتك، تخصصك وعدد ساعات التدريب المطلوبة.',
  },
  {
    icon: '📄',
    index: 'STEP 02',
    title: 'احصل على كتاب الالتحاق',
    body: (
      <>
        راجع جامعتك واطلب <strong>كتاب الالتحاق بالتدريب الميداني</strong> الرسمي الموجّه للشركة.
      </>
    ),
  },
  {
    icon: '🏢',
    index: 'STEP 03',
    title: 'أحضر الكتاب إلى الشركة',
    body: 'زور مقر BATMAN TECHNOLOGY في عمّان، وأحضر الكتاب الجامعي لاستكمال إجراءات الالتحاق وتنسيق الجدول.',
  },
];

function InternshipContactActions() {
  return (
    <div className="ij-enroll-actions">
      {ENROLLMENT_PHONES.map((phone) => (
        <a
          key={phone.display}
          className="ij-call"
          href={phoneHref(phone.international)}
          aria-label={`اتصل على ${phone.display}`}
        >
          📞 {phone.display}
        </a>
      ))}
      <a className="ij-wa" target="_blank" rel="noopener noreferrer" href={whatsappHref()}>
        💬 واتساب التسجيل
      </a>
      <a className="ij-location" target="_blank" rel="noopener noreferrer" href={COMPANY_MAP_URL}>
        📍 افتح موقع الشركة على الخريطة ↗
      </a>
    </div>
  );
}

export function EnrollmentSteps() {
  const [ref, revealed] = useRevealOnScroll();
  return (
    <section ref={ref} id="enrollment" className={`ij-section ij-reveal${revealed ? ' ij-in' : ''}`}>
      <div className="ij-section-title">
        <div className="ij-eyebrow">05 / JOIN THE JOURNEY</div>
        <h2>🎓 كيف تلتحق بالتدريب الميداني؟</h2>
        <p>ثلاث خطوات بسيطة، وبعدها تبدأ رحلتك المهنية مع BATMAN TECHNOLOGY</p>
      </div>
      <div className="ij-glass ij-enroll-panel">
        <div className="ij-enroll-steps">
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
        <InternshipContactActions />
        <div className="ij-enroll-reminder">
          💡 <strong>تذكير:</strong> كتاب الالتحاق من الجامعة مطلوب لإتمام إجراءات التدريب في الشركة. ساعات التدريب
          وأوقات الدوام تُنسّق وفق شروط الجامعة وبعد تأكيد القبول من الشركة.
        </div>
      </div>
    </section>
  );
}

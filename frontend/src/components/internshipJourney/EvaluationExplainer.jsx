import { CAREER_FLOW_STEPS, EVALUATION_WEIGHTS } from '../../features/internshipJourney/index.js';

export function CareerTrackInfo() {
  return (
    <section className="ij-section ij-wrap" id="career-info">
      <div className="ij-section-title">
        <span className="ij-eyebrow">HOW YOUR CAREER TRACK WORKS</span>
        <h2>كيف رح تمشي رحلتك من أول يوم لآخر تسليم؟</h2>
        <p>مو مواد كثيرة؛ ثلاث قدرات وظيفية، مهام قابلة للمراجعة، ومشروع واحد تجمع فيه شغلك.</p>
      </div>
      <div className="ij-glass ij-career-panel">
        <div className="ij-career-grid">
          {CAREER_FLOW_STEPS.map((step) => (
            <article key={step.title} className={`ij-career-step ij-career-step--${step.tone}`}>
              <b>{step.title}</b>
              <p className="ij-small">{step.body}</p>
            </article>
          ))}
        </div>
        <p className="ij-small ij-career-summary">
          توزيع كل خطة: 10% مهارات مهنية، 15% أدوات IT مشتركة، 75% تخصص وظيفي. الساعات الرسمية وأيام الدوام تعتمد
          على متطلبات جامعتك؛ البرنامج لا يزعم جلب تعليمات الجامعات تلقائياً. النجاح الداخلي المقترح 80/100 مع
          استيفاء شروط الحضور والتسليم.
        </p>
      </div>
    </section>
  );
}

export function EvaluationExplainer() {
  return (
    <section className="ij-section" id="evaluation">
      <div className="ij-section-title">
        <div className="ij-eyebrow">04 / EPROJECTO ASSESSMENT</div>
        <h2>كيف راح نقيم شغلك؟ 📊</h2>
        <p>التقييم يعتمد على التزامك ومخرجاتك الفعلية، مش فقط على الحضور</p>
      </div>
      <div className="ij-weights">
        {EVALUATION_WEIGHTS.map((weight) => (
          <div key={weight.key} className="ij-weight">
            <strong>{weight.percent}%</strong>
            <span>{weight.label}</span>
          </div>
        ))}
      </div>
      <div className="ij-note ij-evaluation-note">
        📝{' '}
        <span>
          في البداية Pre-Assessment لقياس المستوى (غير محسوب في العلامة). المهمة غير المسلّمة تُحسب صفراً في متوسط
          المهام. التأهل الداخلي يتطلب 80/100 مع استيفاء شروط الأهلية. إتمام التدريب الجامعي يتطلب أيضاً استيفاء
          الساعات ومتطلبات الجامعة، وقد يختلف تقييم الجامعة الرسمي.
        </span>
      </div>
    </section>
  );
}

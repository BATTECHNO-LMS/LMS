export function PracticalMissions({ plan }) {
  return (
    <section className="ij-section" id="tasks">
      <div className="ij-section-title">
        <div className="ij-eyebrow">03 / REAL-WORLD CHALLENGES</div>
        <h2>بدل المحاضرات... اشتغل على تحديات! 💪</h2>
        <p>هاي أمثلة للمهام اللي رح تنفّذها وتسلّمها للمشرف</p>
      </div>
      <div className="ij-info-layout">
        <div className="ij-info-box ij-glass">
          <h3>🧩 مهماتك العملية</h3>
          <div>
            {plan.previewTasks.map((task, i) => (
              <div key={task} className="ij-task">
                <span className="ij-number">{i + 1}</span>
                <span>{task}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="ij-info-box ij-glass">
          <h3>🏆 مشروعك النهائي</h3>
          <p className="ij-project-text">{plan.projectSummary}</p>
          <div className="ij-note ij-note--success">
            ✅ <span>المطلوب: مشروع أو مخرجات موثّقة + أدلة تنفيذ + مراجعة المشرف + عرض قصير للمشروع.</span>
          </div>
          <h3 className="ij-team-title">🤝 كيف رح يشتغل الفريق؟</h3>
          <p className="ij-team-text">
            تستلم مهمة واضحة، تناقشها مع المشرف، تنفّذها، ترفع الأدلة، تستقبل ملاحظات، ثم تعيد التسليم حتى القبول.
            تختلف أدوات التسليم حسب المسار: تقارير، لوحات مؤشرات، حملات، أو نماذج تشغيل.
          </p>
        </div>
      </div>
    </section>
  );
}

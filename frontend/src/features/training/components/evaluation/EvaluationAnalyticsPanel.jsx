import { useState } from 'react';
import { StatusBadge } from '../../../../components/admin/StatusBadge.jsx';
import { EmptyState } from '../../../../components/common/EmptyState.jsx';

const TABS = [
  { id: 'overview', label: 'نظرة عامة' },
  { id: 'questions', label: 'تفاصيل الأسئلة' },
  { id: 'distributions', label: 'التوزيعات' },
  { id: 'comments', label: 'التعليقات' },
  { id: 'kirkpatrick', label: 'Kirkpatrick' },
];

function Metric({ label, value, sampleSize }) {
  return (
    <div className="eval-analytics__metric">
      <span className="eval-analytics__metric-label">{label}</span>
      <strong className="eval-analytics__metric-value">{value ?? '—'}</strong>
      {sampleSize != null ? <span className="eval-analytics__sample">n={sampleSize}</span> : null}
    </div>
  );
}

function fmtScore(v) {
  return v == null ? '—' : Number(v).toFixed(2);
}

/**
 * Manager/trainer analytics for a program's final evaluation.
 * Renders backend aggregates only — no client-side scoring.
 */
export function EvaluationAnalyticsPanel({ evaluation, learning = null }) {
  const [tab, setTab] = useState('overview');
  if (!evaluation?.isConfigured) {
    return <EmptyState title="التقييم النهائي غير مهيأ" description="اربط قالب التقييم النهائي بهذه الدورة أولًا." />;
  }

  const averages = evaluation.averages || {};
  const nps = evaluation.nps || {};
  const sample = evaluation.sampleSize ?? evaluation.totalSubmitted ?? 0;
  const questions = evaluation.questions || [];
  const ratingQuestions = questions.filter((q) => q.questionType === 'RATING_SCALE');
  const comments = evaluation.comments || [];
  const kirk = evaluation.kirkpatrickLevel1 || {};
  const l2 = learning || {};

  return (
    <div className="eval-analytics" dir="rtl">
      <div className="eval-analytics__status-row">
        <StatusBadge variant={evaluation.isActive ? 'success' : 'muted'}>
          {evaluation.isActive ? 'نشط' : 'غير نشط'}
        </StatusBadge>
        {evaluation.isRequired ? <StatusBadge variant="info">مطلوب للإكمال</StatusBadge> : null}
        {evaluation.template?.title ? <span className="muted">{evaluation.template.title}</span> : null}
      </div>

      <div className="eval-analytics__metrics">
        <Metric label="عدد المستجيبين" value={evaluation.totalSubmitted} sampleSize={sample} />
        <Metric
          label="نسبة الاستجابة"
          value={evaluation.responseRate != null ? `${evaluation.responseRate}%` : '—'}
          sampleSize={evaluation.totalAssignments}
        />
        <Metric label="متوسط تقييم المدرب" value={fmtScore(averages.trainer_score)} sampleSize={sample} />
        <Metric label="متوسط المحتوى" value={fmtScore(averages.content_score)} sampleSize={sample} />
        <Metric label="متوسط الأنشطة" value={fmtScore(averages.activities_score)} sampleSize={sample} />
        <Metric label="متوسط التنظيم" value={fmtScore(averages.organization_score)} sampleSize={sample} />
        <Metric label="متوسط الأثر المباشر" value={fmtScore(averages.immediate_impact_score)} sampleSize={sample} />
        <Metric label="NPS" value={nps.index} sampleSize={nps.totalResponses} />
      </div>

      <div className="eval-analytics__tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`btn btn--sm ${tab === t.id ? 'btn--primary' : 'btn--outline'}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <section>
          <p className="muted">حجم العينة يُعرض مع كل مؤشر. NPS ليس متوسطًا من 5 ولا نسبة رضا.</p>
          <dl className="detail-list">
            <div className="detail-list__row">
              <dt>مروّجون</dt>
              <dd>
                {nps.promoters ?? 0} {nps.promotersPct != null ? `(${nps.promotersPct}%)` : ''}
              </dd>
            </div>
            <div className="detail-list__row">
              <dt>محايدون</dt>
              <dd>
                {nps.passives ?? 0} {nps.passivesPct != null ? `(${nps.passivesPct}%)` : ''}
              </dd>
            </div>
            <div className="detail-list__row">
              <dt>منتقدون</dt>
              <dd>
                {nps.detractors ?? 0} {nps.detractorsPct != null ? `(${nps.detractorsPct}%)` : ''}
              </dd>
            </div>
          </dl>
        </section>
      ) : null}

      {tab === 'questions' ? (
        <section>
          {(evaluation.highestRated || []).length ? (
            <>
              <h4>أعلى تقييمًا</h4>
              <ul className="simple-list">
                {evaluation.highestRated.map((q) => (
                  <li key={q.code}>
                    {q.prompt} — {fmtScore(q.average)} (n={q.n})
                  </li>
                ))}
              </ul>
              <h4>الأقل تقييمًا</h4>
              <ul className="simple-list">
                {(evaluation.lowestRated || []).map((q) => (
                  <li key={q.code}>
                    {q.prompt} — {fmtScore(q.average)} (n={q.n})
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <EmptyState title="لا توجد إجابات بعد" description="ستظهر متوسطات الأسئلة بعد أول إرسال." />
          )}
        </section>
      ) : null}

      {tab === 'distributions' ? (
        <section>
          {ratingQuestions.length ? (
            <ul className="eval-analytics__dist-list">
              {ratingQuestions.map((q) => (
                <li key={q.questionId}>
                  <strong>{q.prompt}</strong>
                  <span className="muted"> n={q.n}</span>
                  <ul>
                    {[5, 4, 3, 2, 1].map((k) => (
                      <li key={k}>
                        {k} — {q.percentages?.[k] ?? 0}%
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="لا توجد توزيعات بعد" />
          )}
        </section>
      ) : null}

      {tab === 'comments' ? (
        <section>
          <p className="muted">تُعرض التعليقات دون هوية المتدرب.</p>
          {comments.some((c) => (c.comments || []).length) ? (
            comments.map((c) => (
              <div key={c.questionCode} className="eval-analytics__comments">
                <h4>{c.prompt}</h4>
                <ul className="simple-list">
                  {(c.comments || []).map((text, i) => (
                    <li key={`${c.questionCode}-${i}`}>{text}</li>
                  ))}
                </ul>
              </div>
            ))
          ) : (
            <EmptyState title="لا توجد تعليقات مفتوحة بعد" />
          )}
        </section>
      ) : null}

      {tab === 'kirkpatrick' ? (
        <section>
          <h4>{kirk.label || 'المستوى الأول — Reaction'}</h4>
          <p className="muted">{kirk.note}</p>
          <dl className="detail-list">
            <div className="detail-list__row">
              <dt>المدرب</dt>
              <dd>{fmtScore(averages.trainer_score)}</dd>
            </div>
            <div className="detail-list__row">
              <dt>المحتوى</dt>
              <dd>{fmtScore(averages.content_score)}</dd>
            </div>
            <div className="detail-list__row">
              <dt>الأنشطة</dt>
              <dd>{fmtScore(averages.activities_score)}</dd>
            </div>
            <div className="detail-list__row">
              <dt>التنظيم</dt>
              <dd>{fmtScore(averages.organization_score)}</dd>
            </div>
            <div className="detail-list__row">
              <dt>الأثر المهني المباشر</dt>
              <dd>{fmtScore(averages.immediate_impact_score)}</dd>
            </div>
            <div className="detail-list__row">
              <dt>NPS</dt>
              <dd>{nps.index ?? '—'}</dd>
            </div>
          </dl>
          <h4>المستوى الثاني — Learning</h4>
          <p className="muted">
            {l2.observation ||
              'يُقاس التعلّم من الاختبار القبلي والبعدي، وليس من استبيان رد الفعل.'}
          </p>
          {l2.caveat ? <p className="muted">{l2.caveat}</p> : null}
          <dl className="detail-list">
            <div className="detail-list__row">
              <dt>متوسط القبلي</dt>
              <dd>{l2.averagePre ?? '—'}</dd>
            </div>
            <div className="detail-list__row">
              <dt>متوسط البعدي</dt>
              <dd>{l2.averagePost ?? '—'}</dd>
            </div>
            <div className="detail-list__row">
              <dt>فرق النقاط المئوية</dt>
              <dd>{l2.averagePp ?? '—'}</dd>
            </div>
          </dl>
          <p className="muted">المستوى الثالث والرابع غير مفعّلين لهذه الدورة (متابعة لاحقة بعد إكمال التدريب).</p>
        </section>
      ) : null}
    </div>
  );
}

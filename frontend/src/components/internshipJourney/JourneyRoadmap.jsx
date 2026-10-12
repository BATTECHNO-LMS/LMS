import { PASS_SCORE, ROADMAP_LEGEND, STAGE_FLOATING_ASSETS } from '../../features/internshipJourney/index.js';
import { useRevealOnScroll } from './useRevealOnScroll.js';

export function stageHoursLabel(stage) {
  return stage.hours ? `${stage.hours} ساعة` : 'تقييم مدمج ضمن المراحل';
}

export function RoadmapStage({ stage, index, onOpen }) {
  const [ref, revealed] = useRevealOnScroll();
  return (
    <div
      ref={ref}
      className={`ij-pathrow ij-reveal${revealed ? ' ij-in' : ''}`}
      style={{ '--color': stage.color }}
    >
      <div className="ij-node" aria-hidden="true">
        {stage.emoji}
      </div>
      <article className="ij-pathcard">
        <small>
          LEVEL {String(index + 1).padStart(2, '0')} · {stage.name}
        </small>
        <h3>{stage.title}</h3>
        <p>{stage.desc}</p>
        <div className="ij-micro">
          {stage.tags.map((tag) => (
            <span key={tag} className="ij-chip">
              {tag}
            </span>
          ))}
        </div>
        <div className="ij-card-foot">
          <strong>{stageHoursLabel(stage)}</strong>
          <button type="button" onClick={(e) => onOpen(stage, e.currentTarget)} aria-haspopup="dialog">
            افتح التحديات ←
          </button>
        </div>
      </article>
      <div className="ij-floating-asset" aria-hidden="true">
        {STAGE_FLOATING_ASSETS[index]}
      </div>
    </div>
  );
}

export function JourneyRoadmap({ plan, onOpenStage }) {
  return (
    <section className="ij-section" id="roadmap">
      <div className="ij-section-title">
        <div className="ij-eyebrow">02 / PERSONALIZED ROADMAP</div>
        <h2>{plan.headline}</h2>
        <p>{plan.subtitle}</p>
      </div>
      <div className="ij-dashboard">
        <div className="ij-metric">
          <div className="ij-big">{plan.hours}h</div>
          <p>إجمالي ساعات التدريب</p>
        </div>
        <div className="ij-metric">
          <div className="ij-big">{plan.weeks}</div>
          <p>أسبوع على أساس 20 ساعة أسبوعياً (نموذج)</p>
        </div>
        <div className="ij-metric">
          <div className="ij-big">{plan.allocation.specialized}h</div>
          <p>ساعات التدريب التخصصي</p>
        </div>
        <div className="ij-metric">
          <div className="ij-big">{PASS_SCORE}/100</div>
          <p>حد التأهل الداخلي</p>
        </div>
      </div>
      <div className="ij-path-legend">
        {ROADMAP_LEGEND.map((item) => (
          <span key={item.label}>
            <i className="ij-legend-dot" style={{ background: item.color }} aria-hidden="true" /> {item.label}
          </span>
        ))}
      </div>
      <div className="ij-trail">
        {plan.stages.map((stage, i) => (
          <RoadmapStage key={`${plan.id}-${stage.title}`} stage={stage} index={i} onOpen={onOpenStage} />
        ))}
      </div>
    </section>
  );
}

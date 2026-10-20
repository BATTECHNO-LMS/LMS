'use strict';

const { renderHtmlToPdf } = require('../analytics/pdfRenderer');
const { getStudentEvidencePortfolio } = require('./fieldTraining.portfolio.service');

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildPortfolioHtml(portfolio) {
  const score = portfolio.score || {};
  const components = score.components || {};
  const sectionHtml = (portfolio.sections || [])
    .map((section) => {
      if (!section.items?.length) return '';
      const body = section.items
        .map((item) => {
          if (section.key === 'logbook') {
            return `<li><strong>${esc(item.entry_date?.toISOString?.()?.slice(0, 10) || item.entry_date)}</strong> — ${esc(item.activity)}<br/><em>${esc(item.learning_outcome)}</em> <span class="badge">معتمد</span></li>`;
          }
          if (section.key === 'tasks') {
            return `<li>${esc(item.title)} — ${item.submitted ? 'مُسلّم' : 'غير مُسلّم'}${item.verification ? ` (${esc(item.verification)})` : ''}</li>`;
          }
          if (section.key === 'skills') {
            return `<li>${esc(item.skill)}</li>`;
          }
          if (section.key === 'recorded_lectures') {
            return `<li>${esc(item.title)} — ${item.completed_at ? 'مكتملة' : `${Math.round(item.progress_percent || 0)}%`}</li>`;
          }
          if (section.key === 'assessments') {
            return `<li>${esc(item.type?.toUpperCase())}: ${item.completed ? 'مكتمل' : 'غير مكتمل'}${item.score != null && item.type !== 'pre' ? ` — ${esc(item.score)}` : ''}${item.type === 'pre' ? ' (غير مقيّم في الدرجة)' : ''}</li>`;
          }
          if (section.key === 'attendance_hours') {
            return `<li>الحضور: ${esc(item.attendance_percentage ?? '—')}% · الساعات: ${esc(item.hours_completed ?? 0)} / ${esc(item.hours_required ?? '—')} ساعة (ليست درجة)</li>`;
          }
          if (section.key === 'completion') {
            return `<li>كتاب الإكمال رقم ${esc(item.letter_no)}</li>`;
          }
          if (section.key === 'student_uploads') {
            return `<li>${esc(item.title)} <span class="badge student">أدلة الطالب</span></li>`;
          }
          if (section.key === 'progress') {
            return `<li>الدرجة: ${esc(item.final_score ?? '—')} / 100 · الأهلية: ${esc(item.eligibility_status || '—')}<br/><small>${esc(item.note_ar || '')}</small></li>`;
          }
          if (section.key === 'overview') {
            return `<li>${esc(item.student_name)} · ${esc(item.opportunity_title)} · ${esc(item.organization_name || '')}</li>`;
          }
          if (section.key === 'evaluations') {
            return `<li>تقييم إشرافي — ${esc(item.rated_at?.toISOString?.()?.slice(0, 10) || item.rated_at || '')}</li>`;
          }
          return `<li>${esc(JSON.stringify(item).slice(0, 120))}</li>`;
        })
        .join('');
      return `<section class="block"><h2>${esc(section.title_ar)}</h2><ul>${body}</ul></section>`;
    })
    .join('');

  const att = components.attendance || {};
  const post = components.postAssessment || {};
  const tasks = components.tasks || {};
  const behavior = components.behavior || {};

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"/>
<title>ملف إنجاز التدريب الميداني</title>
<style>
  body { font-family: "Segoe UI", Tahoma, Arial, sans-serif; color: #1a2744; background: #fff; margin: 0; padding: 28px; }
  h1 { margin: 0 0 8px; font-size: 22px; }
  .eyebrow { color: #4a6fa5; font-size: 12px; letter-spacing: .06em; }
  .gold { height: 3px; width: 120px; background: #c4a574; margin: 12px 0 20px; }
  .score { background: #f7f3ea; border-right: 4px solid #1a2744; padding: 12px 16px; margin-bottom: 18px; }
  .score table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .score td { padding: 4px 0; }
  .block { margin-bottom: 16px; page-break-inside: avoid; }
  .block h2 { font-size: 15px; color: #1a2744; border-bottom: 1px solid rgba(196,165,116,.45); padding-bottom: 6px; }
  ul { padding-right: 18px; margin: 8px 0; }
  li { margin: 6px 0; font-size: 13px; line-height: 1.45; }
  .badge { display: inline-block; font-size: 11px; border: 1px solid #c4a574; padding: 1px 6px; margin-right: 6px; }
  .badge.student { border-color: #4a6fa5; color: #4a6fa5; }
  .note { font-size: 11px; color: #5a6a7a; margin-top: 18px; }
</style>
</head>
<body>
  <p class="eyebrow">eprojecto · Field Training</p>
  <h1>ملف إنجاز التدريب الميداني</h1>
  <div class="gold"></div>
  <p><strong>${esc(portfolio.student?.name)}</strong>
    ${portfolio.student?.number ? `· ${esc(portfolio.student.number)}` : ''}<br/>
    ${esc(portfolio.opportunity?.title)}
    ${portfolio.opportunity?.organization_name ? `· ${esc(portfolio.opportunity.organization_name)}` : ''}
  </p>
  <div class="score">
    <strong>تفصيل الدرجة المعتمدة (بدون سجل التدريب / ملف الإنجاز)</strong>
    <table>
      <tr><td>الحضور</td><td>${esc(att.points ?? '—')} / ${esc(att.maxPoints ?? 20)}</td></tr>
      <tr><td>POST</td><td>${esc(post.points ?? '—')} / ${esc(post.maxPoints ?? 20)}</td></tr>
      <tr><td>المهام</td><td>${esc(tasks.points ?? '—')} / ${esc(tasks.maxPoints ?? 40)}</td></tr>
      <tr><td>السلوك</td><td>${esc(behavior.points ?? '—')} / ${esc(behavior.maxPoints ?? 20)}</td></tr>
      <tr><td><strong>المجموع</strong></td><td><strong>${esc(score.final ?? '—')} / 100</strong></td></tr>
    </table>
  </div>
  ${sectionHtml}
  <p class="note">هذا المستند لا يعرض معرّفات داخلية أو بيانات أمنية. الأدلة الثنائية تُدرج بالاسم فقط.</p>
</body>
</html>`;
}

async function generatePortfolioPdf(applicationId, user) {
  const portfolio = await getStudentEvidencePortfolio(applicationId, user);
  const html = buildPortfolioHtml(portfolio);
  const pdfBuffer = await renderHtmlToPdf(html, {
    format: 'A4',
    printBackground: true,
    margin: { top: '18mm', bottom: '18mm', left: '14mm', right: '14mm' },
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate:
      '<div style="font-size:9px;width:100%;text-align:center;color:#6b7280;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
  });
  const safeName = String(portfolio.student?.name || 'student')
    .replace(/[^\u0600-\u06FFa-zA-Z0-9-_ ]/g, '')
    .slice(0, 40);
  return {
    buffer: pdfBuffer,
    filename: `ملف-إنجاز-${safeName || 'portfolio'}.pdf`,
    portfolio,
  };
}

module.exports = {
  generatePortfolioPdf,
  buildPortfolioHtml,
};

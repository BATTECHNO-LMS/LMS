import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const COLORS = ['#132d4a', '#1e5a8a', '#c9a227', '#2f6b4f', '#b76e1f', '#a33b3b'];

function hasValues(rows) {
  return Array.isArray(rows) && rows.some((r) => r != null && Number(r.value) > 0);
}

function ChartCard({ title, children, empty }) {
  return (
    <article className="ft-report-chart-card">
      <h3 className="ft-report-chart-card__title">{title}</h3>
      {empty ? <p className="crud-muted">{empty}</p> : children}
    </article>
  );
}

export function FieldTrainingReportCharts({ charts = {}, t }) {
  const completion = charts.completion_donut || [];
  const funnel = charts.enrollment_funnel || [];
  const specialties = charts.students_by_specialty || [];
  const orgs = charts.students_by_organization || [];
  const progress = charts.progress_distribution || [];
  const prePost = charts.pre_post || [];
  const reasons = charts.non_completion_reasons || [];

  return (
    <div className="ft-report-charts" dir="rtl">
      <ChartCard title={t('charts.completion')} empty={!hasValues(completion) ? t('charts.empty') : null}>
        {hasValues(completion) ? (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={completion} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} label>
                {completion.map((entry, index) => (
                  <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        ) : null}
      </ChartCard>

      <ChartCard title={t('charts.funnel')} empty={!hasValues(funnel) ? t('charts.empty') : null}>
        {hasValues(funnel) ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={funnel} layout="vertical" margin={{ right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={90} />
              <Tooltip />
              <Bar dataKey="value" fill="#1e5a8a" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : null}
      </ChartCard>

      <ChartCard title={t('charts.specialties')} empty={!hasValues(specialties) ? t('charts.empty') : null}>
        {hasValues(specialties) ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={specialties}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" hide />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#132d4a" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : null}
      </ChartCard>

      <ChartCard title={t('charts.organizations')} empty={!hasValues(orgs) ? t('charts.empty') : null}>
        {hasValues(orgs) ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={orgs}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" hide />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#c9a227" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : null}
      </ChartCard>

      <ChartCard title={t('charts.progress')} empty={!hasValues(progress) ? t('charts.empty') : null}>
        {hasValues(progress) ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={progress}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#2f6b4f" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : null}
      </ChartCard>

      <ChartCard title={t('charts.prePost')} empty={!hasValues(prePost) ? t('charts.emptyAssessments') : null}>
        {hasValues(prePost) ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={prePost}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#1e5a8a" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : null}
      </ChartCard>

      <ChartCard title={t('charts.reasons')} empty={!hasValues(reasons) ? t('charts.empty') : null}>
        {hasValues(reasons) ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={reasons} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={110} />
              <Tooltip />
              <Bar dataKey="value" fill="#b76e1f" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : null}
      </ChartCard>
    </div>
  );
}

export function displayReportValue(value, fallback = 'غير متوفر') {
  if (value == null || value === '') return fallback;
  return value;
}

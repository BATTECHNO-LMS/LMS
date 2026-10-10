import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Label,
} from 'recharts';

const NAVY = '#132d4a';
const GOLD = '#c9a227';
const BLUE = '#3a5f8a';
const IVORY = '#fcfaf5';
const SAND = '#f2ebdd';
const MUTED = '#3e4c5a';
const BORDER = 'rgba(19,45,74,0.08)';

const tooltipStyle = {
  backgroundColor: '#fffefc',
  border: `1px solid ${BORDER}`,
  borderRadius: 12,
  fontSize: 12,
  color: NAVY,
  boxShadow: '0 8px 24px rgba(12,31,53,0.08)',
};

const ROLE_COLORS = [NAVY, GOLD, BLUE, '#4a7c74', '#6b6a8a', '#8aa2b8'];
const SCORE_COLORS = ['#c45c5c', GOLD, '#4a7c74', NAVY];

function DonutCenter({ viewBox, value, label }) {
  const { cx, cy } = viewBox || {};
  if (cx == null || cy == null) return null;
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
      <tspan x={cx} dy="-0.25em" fontSize="22" fontWeight="700" fill={NAVY}>
        {value}
      </tspan>
      <tspan x={cx} dy="1.45em" fontSize="11" fill={MUTED}>
        {label}
      </tspan>
    </text>
  );
}

export function ActiveUsersTrendChart({ data, labels }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="ccActiveFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={NAVY} stopOpacity={0.16} />
            <stop offset="100%" stopColor={NAVY} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
        <XAxis dataKey="label" tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: MUTED, fontSize: 11 }} allowDecimals={false} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend />
        <Area
          type="monotone"
          dataKey="activeUsers"
          name={labels.active}
          stroke={NAVY}
          fill="url(#ccActiveFill)"
          strokeWidth={2}
          dot={{ r: 3, fill: '#fff', stroke: NAVY, strokeWidth: 1.5 }}
          activeDot={{ r: 4.5 }}
        />
        <Line type="monotone" dataKey="newUsers" name={labels.newer} stroke={GOLD} strokeWidth={2} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function RoleDonutChart({ data, onSelect, centerLabel }) {
  const total = data.reduce((sum, row) => sum + Number(row.count || 0), 0);
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="label"
          cx="50%"
          cy="50%"
          innerRadius={62}
          outerRadius={88}
          paddingAngle={2}
          onClick={(entry) => onSelect?.(entry?.role || entry?.payload?.role)}
        >
          {data.map((entry, i) => (
            <Cell key={entry.role || i} fill={ROLE_COLORS[i % ROLE_COLORS.length]} />
          ))}
          <Label
            position="center"
            content={(props) => <DonutCenter {...props} value={total || '—'} label={centerLabel || ''} />}
          />
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function ScoreBarsChart({ data, onSelect }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
        <XAxis dataKey="label" tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: MUTED, fontSize: 11 }} allowDecimals={false} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="count" radius={[6, 6, 0, 0]} onClick={(entry) => onSelect?.(entry?.key || entry?.payload?.key)}>
          {data.map((entry, i) => (
            <Cell key={entry.key || i} fill={SCORE_COLORS[i % SCORE_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AttendanceDonutChart({ present, absent, unspecified, rate, labels }) {
  const data = [
    { key: 'present', label: labels.present, value: present, fill: NAVY },
    { key: 'absent', label: labels.absent, value: absent, fill: '#c41e1e' },
    { key: 'unspecified', label: labels.unspecified, value: unspecified, fill: GOLD },
  ].filter((d) => d.value > 0);
  const center = rate == null ? '—' : `${rate}%`;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={58} outerRadius={84}>
          {data.map((d) => (
            <Cell key={d.key} fill={d.fill} />
          ))}
          <Label
            position="center"
            content={(props) => <DonutCenter {...props} value={center} label={labels.rate || ''} />}
          />
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function OrgBarsChart({ data, onSelect }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
        <XAxis type="number" tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="label" width={120} tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar
          dataKey="value"
          fill={BLUE}
          radius={[0, 6, 6, 0]}
          onClick={(entry) => onSelect?.(entry?.id || entry?.payload?.id)}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ActivityHeatmap({ cells = [], labels }) {
  const days = [0, 1, 2, 3, 4, 5, 6];
  const hours = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];
  const map = new Map(cells.map((c) => [`${c.dayOfWeek}-${c.hourBucket}`, c.count]));
  const max = Math.max(1, ...cells.map((c) => c.count));
  const dayNames = labels?.days || ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

  function color(v) {
    if (!v) return IVORY;
    const t = v / max;
    if (t < 0.25) return SAND;
    if (t < 0.55) return '#8aa2b8';
    if (t < 0.8) return BLUE;
    return NAVY;
  }

  return (
    <div className="cc-heatmap" role="img" aria-label={labels?.title || 'heatmap'}>
      <div className="cc-heatmap__grid">
        <div className="cc-heatmap__row">
          <span />
          {hours.map((h) => (
            <span key={h} className="cc-heatmap__hour">
              {String(h).padStart(2, '0')}
            </span>
          ))}
        </div>
        {days.map((d) => (
          <div key={d} className="cc-heatmap__row">
            <span className="cc-heatmap__day">{dayNames[d]}</span>
            {hours.map((h) => {
              const v = map.get(`${d}-${h}`) || 0;
              return (
                <span
                  key={h}
                  className="cc-heatmap__cell"
                  title={`${dayNames[d]} ${h}:00 — ${v}`}
                  style={{ background: color(v) }}
                >
                  <span className="sr-only">{v}</span>
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <p className="cc-heatmap__legend">
        {labels?.low || 'أقل نشاط'} <span className="cc-heatmap__swatch" style={{ background: IVORY }} />
        <span className="cc-heatmap__swatch" style={{ background: SAND }} />
        <span className="cc-heatmap__swatch" style={{ background: BLUE }} />
        <span className="cc-heatmap__swatch" style={{ background: NAVY }} /> {labels?.high || 'أعلى نشاط'}
      </p>
    </div>
  );
}

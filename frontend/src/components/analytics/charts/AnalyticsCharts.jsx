import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';

const PRIMARY = '#6a73fa';
const SECONDARY = '#673bb7';
const MUTED = '#737b8b';
const BORDER = '#e6e6e6';

const tooltipStyle = {
  backgroundColor: '#fff',
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  fontSize: 12,
};

export function UniversitiesOverviewChart({ data, dataKeys }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
        <XAxis dataKey="label" tick={{ fill: MUTED, fontSize: 11 }} />
        <YAxis tick={{ fill: MUTED, fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend />
        <Bar dataKey="cohorts" name={dataKeys.cohorts} fill={PRIMARY} radius={[4, 4, 0, 0]} />
        <Bar dataKey="students" name={dataKeys.students} fill={SECONDARY} radius={[4, 4, 0, 0]} />
        <Bar dataKey="recognitionRequests" name={dataKeys.recognition} fill="#a78bfa" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function EnrollmentGrowthChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
        <XAxis dataKey="label" tick={{ fill: MUTED, fontSize: 11 }} />
        <YAxis tick={{ fill: MUTED, fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Line type="monotone" dataKey="enrollments" stroke={PRIMARY} strokeWidth={2} dot={{ fill: PRIMARY }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CohortStatusDonutChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} dataKey="count" nameKey="label" cx="50%" cy="50%" innerRadius={56} outerRadius={88} paddingAngle={2}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function AssessmentHealthChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
        <XAxis type="number" tick={{ fill: MUTED, fontSize: 11 }} />
        <YAxis type="category" dataKey="label" width={120} tick={{ fill: MUTED, fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="value" fill={PRIMARY} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AttendanceTrendChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
        <XAxis dataKey="label" tick={{ fill: MUTED, fontSize: 11 }} />
        <YAxis tick={{ fill: MUTED, fontSize: 11 }} domain={[80, 100]} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area type="monotone" dataKey="rate" stroke={SECONDARY} fill="#673bb733" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function EvidenceDonutChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={50} outerRadius={80}>
          {data.map((entry, index) => (
            <Cell key={`e-${index}`} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function QaIntegrityBarChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
        <XAxis dataKey="label" tick={{ fill: MUTED, fontSize: 11 }} />
        <YAxis tick={{ fill: MUTED, fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="value" fill={PRIMARY} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RecognitionFunnelChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
        <XAxis type="number" tick={{ fill: MUTED, fontSize: 11 }} />
        <YAxis type="category" dataKey="label" width={140} tick={{ fill: MUTED, fontSize: 10 }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="count" fill={SECONDARY} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CertificatesLineChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
        <XAxis dataKey="label" tick={{ fill: MUTED, fontSize: 11 }} />
        <YAxis tick={{ fill: MUTED, fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Line type="monotone" dataKey="count" stroke={PRIMARY} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CertificatesByUniversityChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
        <XAxis dataKey="label" tick={{ fill: MUTED, fontSize: 11 }} />
        <YAxis tick={{ fill: MUTED, fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="count" fill={PRIMARY} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CertificatesByCredentialChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
        <XAxis type="number" tick={{ fill: MUTED, fontSize: 11 }} />
        <YAxis type="category" dataKey="label" width={130} tick={{ fill: MUTED, fontSize: 10 }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="count" fill={SECONDARY} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

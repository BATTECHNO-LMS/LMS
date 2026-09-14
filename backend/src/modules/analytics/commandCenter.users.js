'use strict';

const { prisma } = require('../../config/db');
const { Prisma } = require('@prisma/client');
const { PRESENCE_WINDOW_SECONDS } = require('./analytics.definitions');
const { periodChange, intCount, safePercent } = require('./analytics.percent');
const { formatAmmanLabel } = require('./analytics.period');
const { scopeUsersSql, scopeAuditSql, roleUserSql, nonMeaningfulSql } = require('./commandCenter.sql');

const STUDENT_LIKE = ['student', 'trainee'];

async function countDistinctActive(scope, from, to) {
  const rows = await prisma.$queryRaw`
    SELECT COUNT(DISTINCT al.user_id)::int AS c
    FROM audit_logs al
    JOIN users u ON u.id = al.user_id
    WHERE al.created_at >= ${from}
      AND al.created_at < ${to}
      AND al.user_id IS NOT NULL
      ${nonMeaningfulSql}
      ${scopeAuditSql(scope)}
      ${scopeUsersSql(scope)}
      ${roleUserSql(scope)}
  `;
  return intCount(rows[0]?.c);
}

async function countNewUsers(scope, from, to) {
  const rows = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS c
    FROM users u
    WHERE u.created_at >= ${from}
      AND u.created_at < ${to}
      ${scopeUsersSql(scope)}
      ${roleUserSql(scope)}
  `;
  return intCount(rows[0]?.c);
}

async function countStudents(scope) {
  const rows = await prisma.$queryRaw`
    SELECT COUNT(DISTINCT u.id)::int AS c
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON r.id = ur.role_id
    WHERE r.code IN (${Prisma.join(STUDENT_LIKE.map((c) => Prisma.sql`${c}`))})
      ${scopeUsersSql(scope)}
      ${roleUserSql(scope)}
  `;
  return intCount(rows[0]?.c);
}

async function roleDistribution(scope) {
  const rows = await prisma.$queryRaw`
    SELECT r.code AS role, COUNT(DISTINCT u.id)::int AS count
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON r.id = ur.role_id
    WHERE 1=1
      ${scopeUsersSql(scope)}
      ${roleUserSql(scope)}
    GROUP BY r.code
    ORDER BY count DESC
  `;
  const total = rows.reduce((s, r) => s + intCount(r.count), 0);
  return rows.map((r) => ({
    role: r.role,
    count: intCount(r.count),
    percent: safePercent(r.count, total, 1),
  }));
}

function truncUnit(aggregation) {
  if (aggregation === 'hourly') return 'hour';
  if (aggregation === 'weekly') return 'week';
  return 'day';
}

async function userTrend(scope, period) {
  const unit = truncUnit(period.aggregation);
  const [activeRows, newRows] = await Promise.all([
    prisma.$queryRaw`
      SELECT
        date_trunc(${unit}::text, al.created_at AT TIME ZONE 'Asia/Amman') AS bucket,
        COUNT(DISTINCT al.user_id)::int AS active_users
      FROM audit_logs al
      JOIN users u ON u.id = al.user_id
      WHERE al.created_at >= ${period.periodStart}
        AND al.created_at < ${period.periodEnd}
        AND al.user_id IS NOT NULL
        ${nonMeaningfulSql}
        ${scopeAuditSql(scope)}
        ${scopeUsersSql(scope)}
        ${roleUserSql(scope)}
      GROUP BY 1
      ORDER BY 1
    `,
    prisma.$queryRaw`
      SELECT
        date_trunc(${unit}::text, u.created_at AT TIME ZONE 'Asia/Amman') AS bucket,
        COUNT(*)::int AS new_users
      FROM users u
      WHERE u.created_at >= ${period.periodStart}
        AND u.created_at < ${period.periodEnd}
        ${scopeUsersSql(scope)}
        ${roleUserSql(scope)}
      GROUP BY 1
      ORDER BY 1
    `,
  ]);

  const map = new Map();
  for (const row of activeRows) {
    const key = new Date(row.bucket).toISOString();
    map.set(key, {
      bucket: new Date(row.bucket).toISOString(),
      label: formatAmmanLabel(new Date(row.bucket), period.aggregation),
      activeUsers: intCount(row.active_users),
      newUsers: 0,
    });
  }
  for (const row of newRows) {
    const key = new Date(row.bucket).toISOString();
    const cur = map.get(key) || {
      bucket: new Date(row.bucket).toISOString(),
      label: formatAmmanLabel(new Date(row.bucket), period.aggregation),
      activeUsers: 0,
      newUsers: 0,
    };
    cur.newUsers = intCount(row.new_users);
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => a.bucket.localeCompare(b.bucket));
}

async function getUserAnalytics(scope, period) {
  const [activeUsers, previousActive, newUsers, previousNew, totalStudents, roles, trend] = await Promise.all([
    countDistinctActive(scope, period.periodStart, period.periodEnd),
    countDistinctActive(scope, period.previousStart, period.previousEnd),
    countNewUsers(scope, period.periodStart, period.periodEnd),
    countNewUsers(scope, period.previousStart, period.previousEnd),
    countStudents(scope),
    roleDistribution(scope),
    userTrend(scope, period),
  ]);

  return {
    onlineUsers: {
      available: false,
      reason: 'AUTH_SESSIONS_NOT_AVAILABLE',
      presenceWindowSeconds: PRESENCE_WINDOW_SECONDS,
      value: null,
      definition: 'Requires auth_sessions.lastSeenAt. Not inferred from last_login_at.',
    },
    activeUsers: {
      value: activeUsers,
      comparison: periodChange(activeUsers, previousActive, { hasPreviousPeriod: period.hasComparison }),
      definition: 'Distinct users with a meaningful audit_logs action in the selected period.',
    },
    newUsers: {
      value: newUsers,
      comparison: periodChange(newUsers, previousNew, { hasPreviousPeriod: period.hasComparison }),
    },
    totalStudents: { value: totalStudents },
    roleDistribution: roles,
    trend,
    sparkline: trend.slice(-14).map((p) => p.activeUsers),
  };
}

module.exports = {
  getUserAnalytics,
  countDistinctActive,
  countStudents,
};

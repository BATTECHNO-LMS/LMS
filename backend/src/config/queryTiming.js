'use strict';

const { AsyncLocalStorage } = require('node:async_hooks');

const queryAls = new AsyncLocalStorage();

function isPerfLoggingEnabled() {
  const v = process.env.PERF_LOGGING;
  return v === 'true' || v === '1';
}

function runWithQueryTiming(fn) {
  return queryAls.run({ queries: [] }, fn);
}

function summarizeSql(sql) {
  if (!sql || typeof sql !== 'string') return 'unknown';
  return sql.replace(/\s+/g, ' ').trim().slice(0, 180);
}

function recordQuery(entry) {
  const store = queryAls.getStore();
  if (!store) return;
  store.queries.push({
    durationMs: Number(entry.durationMs) || 0,
    target: String(entry.target || ''),
    sql: summarizeSql(entry.sql),
  });
}

function getQueryTimingSummary() {
  const store = queryAls.getStore();
  const queries = store?.queries || [];
  const totalMs = queries.reduce((sum, q) => sum + q.durationMs, 0);
  return { count: queries.length, totalMs, queries };
}

module.exports = {
  isPerfLoggingEnabled,
  runWithQueryTiming,
  recordQuery,
  getQueryTimingSummary,
  summarizeSql,
  summarizeSql: summarizeSql,
};

import { keepPreviousData } from '@tanstack/react-query';

/** Shared stale times (ms) — tune per data volatility. */
export const STALE = {
  auth: 3 * 60 * 1000,
  catalog: 15 * 60 * 1000,
  universities: 15 * 60 * 1000,
  specialties: 15 * 60 * 1000,
  dashboard: 90 * 1000,
  list: 60 * 1000,
  fieldTraining: 90 * 1000,
  notifications: 30 * 1000,
  detail: 60 * 1000,
};

/** Keep prior page/filter results visible while refetching. */
export const keepPreviousListData = keepPreviousData;

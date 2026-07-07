/**
 * Compute inclusive from/to (YYYY-MM-DD) for analytics time presets.
 * Returns { from, to } — empty strings mean no date bound (all time).
 */
export function computeDateRangeForPreset(timePreset, refDate = new Date()) {
  if (timePreset === 'custom' || timePreset === 'all') {
    return timePreset === 'all' ? { from: '', to: '' } : null;
  }

  const now = new Date(refDate);
  const to = now.toISOString().slice(0, 10);
  let from = '';

  if (timePreset === 'today') {
    from = to;
  } else if (timePreset === 'last7') {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    from = d.toISOString().slice(0, 10);
  } else if (timePreset === 'last30') {
    const d = new Date(now);
    d.setDate(d.getDate() - 29);
    from = d.toISOString().slice(0, 10);
  } else if (timePreset === 'last90') {
    const d = new Date(now);
    d.setDate(d.getDate() - 89);
    from = d.toISOString().slice(0, 10);
  } else if (timePreset === 'thisYear') {
    from = `${now.getFullYear()}-01-01`;
  } else if (timePreset === 'thisTerm') {
    from = `${now.getFullYear()}-${now.getMonth() < 6 ? '01' : '07'}-01`;
  } else {
    return null;
  }

  return { from, to };
}

export function buildInitialAnalyticsFilters() {
  const range = computeDateRangeForPreset('last30');
  return {
    universityId: '',
    trackId: '',
    microCredentialId: '',
    cohortId: '',
    timePreset: 'last30',
    from: range?.from ?? '',
    to: range?.to ?? '',
  };
}

export const ANALYTICS_TIME_PRESETS = ['today', 'last7', 'last30', 'last90', 'thisYear', 'all'];

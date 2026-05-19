/** Shared UI helpers for field training pages (no API logic). */

export function applicationBadgeVariant(status) {
  if (status === 'approved') return 'success';
  if (status === 'rejected') return 'danger';
  if (status === 'cancelled') return 'muted';
  if (status === 'pending') return 'warning';
  return 'muted';
}

export function opportunityStatusVariant(status) {
  if (status === 'published') return 'success';
  if (status === 'archived') return 'muted';
  return 'warning';
}

export function getApplicationTabKey(status) {
  if (!status || status === 'cancelled') return 'not_applied';
  return status;
}

export function canApplyToOpportunity(opp) {
  const st = opp?.my_application_status;
  return !st || st === 'cancelled';
}

export function computeStudentListStats(opportunities) {
  const list = opportunities ?? [];
  let pending = 0;
  let approved = 0;
  list.forEach((o) => {
    if (o.my_application_status === 'pending') pending += 1;
    if (o.my_application_status === 'approved') approved += 1;
  });
  return {
    available: list.length,
    pending,
    approved,
  };
}

export function computeAdminListStats(rows) {
  const list = rows ?? [];
  let published = 0;
  let draft = 0;
  let pendingApps = 0;
  let approvedApps = 0;
  list.forEach((r) => {
    if (r.status === 'published') published += 1;
    if (r.status === 'draft') draft += 1;
    pendingApps += Number(r.pending_applications_count ?? 0);
    approvedApps += Number(r.approved_applications_count ?? 0);
  });
  return {
    total: list.length,
    published,
    draft,
    pendingApps,
    approvedApps,
  };
}

export function computeApplicationStats(applications) {
  const list = applications ?? [];
  return {
    total: list.length,
    pending: list.filter((a) => a.status === 'pending').length,
    approved: list.filter((a) => a.status === 'approved').length,
    rejected: list.filter((a) => a.status === 'rejected').length,
  };
}

export function filterOpportunitiesByTab(opportunities, tab) {
  if (!tab || tab === 'all') return opportunities;
  return opportunities.filter((o) => {
    const key = getApplicationTabKey(o.my_application_status);
    if (tab === 'not_applied') return key === 'not_applied';
    return key === tab;
  });
}

export function formatFtDate(value) {
  if (!value) return null;
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

export function truncateText(text, max = 120) {
  const s = String(text ?? '').trim();
  if (!s) return '';
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

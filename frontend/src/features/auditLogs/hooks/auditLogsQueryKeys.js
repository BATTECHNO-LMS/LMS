export const auditLogsKeys = {
  all: ['audit-logs'],
  list: (params) => [...auditLogsKeys.all, 'list', params],
  detail: (id) => [...auditLogsKeys.all, 'detail', id],
};

export const notificationsKeys = {
  all: ['notifications'],
  list: (params) => [...notificationsKeys.all, 'list', params],
  detail: (id) => [...notificationsKeys.all, 'detail', id],
};

export const certificatesKeys = {
  all: ['certificates'],
  list: (params) => [...certificatesKeys.all, 'list', params],
  detail: (id) => [...certificatesKeys.all, 'detail', id],
  verify: (code) => [...certificatesKeys.all, 'verify', code],
};

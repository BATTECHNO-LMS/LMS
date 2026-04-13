import { useMutation, useQueryClient } from '@tanstack/react-query';
import { patchCertificateStatus } from '../certificates.service.js';
import { certificatesKeys } from './certificatesQueryKeys.js';

export function useUpdateCertificateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => patchCertificateStatus(id, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: certificatesKeys.all });
      if (vars?.id) qc.invalidateQueries({ queryKey: certificatesKeys.detail(vars.id) });
    },
  });
}

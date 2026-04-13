import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createCertificate } from '../certificates.service.js';
import { certificatesKeys } from './certificatesQueryKeys.js';

export function useCreateCertificate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => createCertificate(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: certificatesKeys.all });
    },
  });
}

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateRolePermissions } from '../roles.service.js';
import { rolesKeys } from './useRolesOverview.js';

export function useUpdateRolePermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, permissionCodes }) => updateRolePermissions(roleId, permissionCodes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: rolesKeys.all });
    },
  });
}

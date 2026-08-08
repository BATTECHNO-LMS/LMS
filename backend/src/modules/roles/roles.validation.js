const { z } = require('zod');
const { ALL_PERMISSION_CODES } = require('../../utils/permissionCatalog');

const uuidParamSchema = z.object({
  id: z.string().uuid(),
});

const roleIdOrCodeParamSchema = z.object({
  id: z.string().min(1).max(80),
});

const updateRolePermissionsBodySchema = z
  .object({
    permission_codes: z
      .array(z.string().min(1).max(120))
      .max(ALL_PERMISSION_CODES.length + 10),
  })
  .strict();

module.exports = {
  uuidParamSchema,
  roleIdOrCodeParamSchema,
  updateRolePermissionsBodySchema,
};

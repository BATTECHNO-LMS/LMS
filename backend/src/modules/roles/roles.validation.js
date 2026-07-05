const { z } = require('zod');

const uuidParamSchema = z.object({
  id: z.string().uuid(),
});

module.exports = { uuidParamSchema };

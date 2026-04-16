/** DB behind schema (migrations not applied) — detect Prisma "table does not exist" for a model. */
function isMissingPrismaModelTableError(err, modelName) {
  if (!err || typeof err !== 'object') return false;
  const blob = `${err.message || ''} ${JSON.stringify(err.meta || {})}`;
  const re = new RegExp(modelName, 'i');
  if (!re.test(blob) || !/does not exist|not exist in the current database/i.test(blob)) return false;
  const msg = String(err.message);
  // P2021 = table not found; message shape can vary slightly by Prisma version.
  if (err.code === 'P2021') return true;
  return new RegExp(`prisma\\.${modelName}`, 'i').test(msg);
}

module.exports = { isMissingPrismaModelTableError };

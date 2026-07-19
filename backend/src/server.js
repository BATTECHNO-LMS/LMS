const app = require('./app');
const { env } = require('./config/env');
const { prisma } = require('./config/db');
const { validateJwtSecret } = require('./config/jwtSecretValidation');

const port = env.PORT;

function assertProductionConfig() {
  if (env.NODE_ENV !== 'production') return;
  const errors = [];
  if (!env.DATABASE_URL) errors.push('DATABASE_URL is required in production');
  const jwtCheck = validateJwtSecret(env.JWT_SECRET, { minLength: env.JWT_SECRET_MIN_LENGTH });
  if (!jwtCheck.ok) {
    errors.push(jwtCheck.reason);
  }
  if (env.STORAGE_BACKEND === 'r2') {
    const { getRequiredR2Config } = require('./shared/storage/providers/r2.provider');
    const missing = getRequiredR2Config();
    if (missing.length) errors.push(`R2 storage missing env: ${missing.join(', ')}`);
  }
  if (env.AI_PROVIDER) {
    if (env.AI_PROVIDER === 'gemini' && !env.GEMINI_API_KEY) {
      errors.push('GEMINI_API_KEY is required when AI_PROVIDER=gemini');
    }
    if (env.AI_PROVIDER === 'openai' && !env.OPENAI_API_KEY) {
      errors.push('OPENAI_API_KEY is required when AI_PROVIDER=openai');
    }
  }
  if (errors.length) {
    // eslint-disable-next-line no-console
    console.error('Invalid production configuration:\n', errors.join('\n'));
    process.exit(1);
  }
}

function warnDevStorageAiConfig() {
  if (env.NODE_ENV === 'production') return;
  if (env.STORAGE_BACKEND === 'r2') {
    const { getRequiredR2Config } = require('./shared/storage/providers/r2.provider');
    const missing = getRequiredR2Config();
    if (missing.length) {
      // eslint-disable-next-line no-console
      console.warn(`[storage] R2 enabled but missing: ${missing.join(', ')}`);
    }
  }
  if (env.AI_PROVIDER === 'gemini' && !env.GEMINI_API_KEY) {
    // eslint-disable-next-line no-console
    console.warn('[ai] AI_PROVIDER=gemini but GEMINI_API_KEY is not set — AI disabled');
  }
}

async function start() {
  assertProductionConfig();
  warnDevStorageAiConfig();
  if (!env.DATABASE_URL) {
    // eslint-disable-next-line no-console
    console.warn('DATABASE_URL is not set; starting without a database connection.');
  } else {
    await prisma.$connect();
    // eslint-disable-next-line no-console
    console.log('Connected to the database.');
  }

  const server = app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`BATTECHNO-LMS API listening on port ${port}`);
  });

  async function shutdown(signal) {
    // eslint-disable-next-line no-console
    console.log(`${signal} received; closing HTTP server and database pool.`);
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    try {
      await prisma.$disconnect();
    } catch {
      /* ignore */
    }
    process.exit(0);
  }

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      // eslint-disable-next-line no-console
      console.error(
        `Port ${port} is already in use. Stop the other process or set PORT in backend/.env.`
      );
      process.exit(1);
      return;
    }
    // eslint-disable-next-line no-console
    console.error('HTTP server error:', err);
  });

  process.on('unhandledRejection', (reason) => {
    // eslint-disable-next-line no-console
    console.error('Unhandled promise rejection:', reason);
  });

  process.on('uncaughtException', (err) => {
    // eslint-disable-next-line no-console
    console.error('Uncaught exception:', err);
  });
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to connect to the database.', err);
  process.exit(1);
});

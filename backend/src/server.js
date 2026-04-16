const app = require('./app');
const { env } = require('./config/env');
const { prisma } = require('./config/db');

const port = env.PORT;

function assertProductionConfig() {
  if (env.NODE_ENV !== 'production') return;
  const errors = [];
  if (!env.DATABASE_URL) errors.push('DATABASE_URL is required in production');
  if (!env.JWT_SECRET || env.JWT_SECRET.length < env.JWT_SECRET_MIN_LENGTH) {
    errors.push(`JWT_SECRET must be at least ${env.JWT_SECRET_MIN_LENGTH} characters in production`);
  }
  if (!env.CORS_ORIGINS.length) errors.push('CORS_ORIGINS must list at least one origin in production');
  if (errors.length) {
    // eslint-disable-next-line no-console
    console.error('Invalid production configuration:\n', errors.join('\n'));
    process.exit(1);
  }
}

async function start() {
  assertProductionConfig();
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
    throw err;
  });
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to connect to the database.', err);
  process.exit(1);
});

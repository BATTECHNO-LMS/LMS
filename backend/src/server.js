const app = require('./app');
const { env } = require('./config/env');
const { prisma } = require('./config/db');

const port = env.PORT;

async function start() {
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

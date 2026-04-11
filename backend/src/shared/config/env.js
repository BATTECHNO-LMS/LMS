const path = require('path');

// Resolve backend/.env regardless of process cwd (e.g. monorepo root).
require('dotenv').config({
  path: path.join(__dirname, '..', '..', '..', '.env'),
});

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT) || 4000,
  DATABASE_URL: process.env.DATABASE_URL || '',
  JWT_SECRET: process.env.JWT_SECRET || '',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  UPLOAD_DIR: process.env.UPLOAD_DIR || 'uploads',
};

module.exports = { env };

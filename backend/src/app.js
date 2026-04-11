const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const routes = require('./routes');
const authRoutes = require('./modules/auth/auth.routes');
const { env } = require('./config/env');
const { errorMiddleware } = require('./middlewares/error.middleware');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(
  '/uploads',
  express.static(path.join(__dirname, '..', env.UPLOAD_DIR))
);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'battechno-lms-api' });
});

app.use('/api/auth', authRoutes);
app.use(`/api/${env.API_VERSION}`, routes);

app.use(errorMiddleware);

module.exports = app;

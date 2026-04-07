const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const routes = require('./routes');
const { env } = require('./shared/config');

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

app.use(`/api/${require('./shared/constants').API_VERSION}`, routes);

module.exports = app;

const express = require('express');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/authorization.middleware');
const { env } = require('../../config/env');
const dashboardController = require('./dashboard.controller');

const router = express.Router();

const adminRead = authorizeRoles(...env.ADMIN_READ_ROLE_CODES);

router.get('/admin-stats', authenticate, adminRead, dashboardController.adminStats);

module.exports = router;

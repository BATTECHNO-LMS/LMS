const express = require('express');
const { authMiddleware } = require('../../middlewares/auth.middleware');
const usersController = require('./users.controller');

const router = express.Router();

router.get('/', authMiddleware, usersController.list);

module.exports = router;

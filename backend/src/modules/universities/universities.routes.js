const express = require('express');
const universitiesController = require('./universities.controller');

const router = express.Router();

router.get('/', universitiesController.list);

module.exports = router;

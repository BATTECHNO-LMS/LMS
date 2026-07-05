const express = require('express');
const specialtiesController = require('./specialties.controller');

const router = express.Router();

router.get('/', specialtiesController.listActive);

module.exports = router;

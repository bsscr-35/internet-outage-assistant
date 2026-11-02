const express = require('express');
const { getComponents } = require('../controllers/componentController');

const router = express.Router();

router.get('/components', getComponents);

module.exports = router;

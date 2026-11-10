const express = require('express');
const { createComponent, getComponents } = require('../controllers/componentController');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.get('/components', getComponents);
router.post('/components', requireAuth, createComponent);

module.exports = router;

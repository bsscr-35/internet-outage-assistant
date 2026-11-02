const express = require('express');
const { getImpacts } = require('../controllers/impactController');

const router = express.Router();

router.get('/impacts', getImpacts);

module.exports = router;

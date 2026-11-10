const express = require('express');
const { createOutageImpact, getImpacts } = require('../controllers/impactController');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.get('/impacts', getImpacts);
router.post('/outages/:id/impacts', requireAuth, createOutageImpact);

module.exports = router;

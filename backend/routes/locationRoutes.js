const express = require('express');
const { createLocation, getLocationSummary } = require('../controllers/locationController');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.get('/locations', getLocationSummary);
router.post('/locations', requireAuth, createLocation);

module.exports = router;

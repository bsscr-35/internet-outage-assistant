const express = require('express');
const {
  createOutage,
  getOutages,
  getOutageById,
  updateOutageStatus,
} = require('../controllers/outageController');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.get('/outages', getOutages);
router.post('/outages', requireAuth, createOutage);
router.patch('/outages/:id/status', requireAuth, updateOutageStatus);
router.get('/outages/:id', getOutageById);

module.exports = router;

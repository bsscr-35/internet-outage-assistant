const express = require('express');
const {
  getOutages,
  getOutageById,
} = require('../controllers/outageController');

const router = express.Router();

router.get('/outages', getOutages);
router.get('/outages/:id', getOutageById);

module.exports = router;

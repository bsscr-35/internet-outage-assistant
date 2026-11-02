const express = require('express');
const { getDashboardStats } = require('../controllers/dashboardController');

const router = express.Router();

router.get('/dashboard/stats', getDashboardStats);

module.exports = router;

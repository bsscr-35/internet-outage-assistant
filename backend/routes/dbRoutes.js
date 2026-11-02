const express = require('express');
const { getDatabaseHealth } = require('../controllers/dbController');

const router = express.Router();

router.get('/db-test', getDatabaseHealth);

module.exports = router;

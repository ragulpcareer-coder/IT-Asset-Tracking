const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getDashboardMetrics } = require('../controllers/dashboardController');

// GET /api/dashboard/metrics
// All authenticated users can fetch dashboard KPIs
router.get('/metrics', protect, getDashboardMetrics);

module.exports = router;

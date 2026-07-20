const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getDashboardMetrics, getDashboardAnalytics, getPredictiveIntelligence } = require('../controllers/dashboardController');

// GET /api/dashboard/metrics
// All authenticated users can fetch dashboard KPIs
router.get('/metrics', protect, getDashboardMetrics);
router.get('/analytics', protect, getDashboardAnalytics);
router.get('/predictive-intelligence', protect, getPredictiveIntelligence);

module.exports = router;

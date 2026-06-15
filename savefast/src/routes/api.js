const express = require('express');
const router = express.Router();

// Middleware references
const authMiddleware = require('../middlewares/auth');
const { downloadLimiter, adminLimiter } = require('../middlewares/rateLimiter');
const { urlValidator } = require('../validators/url');

// Controllers references
const { downloadMedia, getMediaInfo } = require('../controllers/downloader');
const { getPublicConfig, getAdminConfig, updateAdminConfig } = require('../controllers/config');

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    name: 'SaveFast API Backend',
    timestamp: new Date()
  });
});

/**
 * Public Downloader Actions
 */
router.post('/download', downloadLimiter, urlValidator, downloadMedia);
router.post('/info', downloadLimiter, urlValidator, getMediaInfo);

/**
 * Public Configurations
 */
router.get('/config', getPublicConfig);

/**
 * Protected Admin Configurations
 */
router.get('/admin/config', adminLimiter, authMiddleware, getAdminConfig);
router.put('/admin/config', adminLimiter, authMiddleware, updateAdminConfig);

module.exports = router;

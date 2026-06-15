const rateLimit = require('express-rate-limit');

// Rate limiting for public downloader endpoints (15 requests per 15 minutes per IP)
const downloadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // limit each IP to 15 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    success: false,
    message: 'Too many downloader requests from this IP. Please try again after 15 minutes.'
  }
});

// Strict rate limiting for Admin Panel actions (30 requests per 15 minutes per IP)
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication or config requests from this IP. Action throttled.'
  }
});

module.exports = {
  downloadLimiter,
  adminLimiter
};

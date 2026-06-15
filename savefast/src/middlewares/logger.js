const morgan = require('morgan');
const { NODE_ENV } = require('../config/env');

// Simple log format for development vs production
const format = NODE_ENV === 'development' ? 'dev' : 'combined';

const loggerMiddleware = morgan(format, {
  skip: (req, res) => {
    // Skip logging health checks to keep logs cleaner
    return req.originalUrl === '/api/health';
  }
});

module.exports = loggerMiddleware;

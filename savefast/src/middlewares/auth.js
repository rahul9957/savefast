const { ADMIN_API_KEY } = require('../config/env');

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Missing or invalid authentication token.'
    });
  }

  const token = authHeader.split(' ')[1];

  if (token !== ADMIN_API_KEY) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Invalid authorization credentials.'
    });
  }

  next();
};

module.exports = authMiddleware;

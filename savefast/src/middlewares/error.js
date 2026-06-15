const { db } = require('../firebase/firebase');

const errorHandler = async (err, req, res, next) => {
  const statusCode = err.status || 500;
  const message = err.message || 'Internal Server Error';

  console.error(`[Error Handler] Endpoint: ${req.method} ${req.originalUrl} - Msg: ${message}`);
  if (err.stack) {
    console.error(err.stack);
  }

  // Attempt to store error details in Firestore 'errors' collection asynchronously
  if (db) {
    try {
      await db.collection('errors').add({
        message: message,
        stack: err.stack || 'No stack trace available.',
        endpoint: `${req.method} ${req.originalUrl}`,
        timestamp: new Date(),
        ip: req.ip || req.headers['x-forwarded-for'] || 'Unknown'
      });
    } catch (dbErr) {
      console.error('Failed to log error details to Firestore:', dbErr.message);
    }
  }

  res.status(statusCode).json({
    success: false,
    message: message,
    // Avoid exposing stack traces in production
    error: process.env.NODE_ENV === 'production' ? null : err.stack
  });
};

module.exports = errorHandler;

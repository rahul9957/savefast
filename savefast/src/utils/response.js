/**
 * Uniform API Response Utility
 */

const sendSuccess = (res, data, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    ...data
  });
};

const sendError = (res, message, statusCode = 400, errorDetails = null) => {
  return res.status(statusCode).json({
    success: false,
    message,
    ...(errorDetails && { error: errorDetails })
  });
};

module.exports = {
  sendSuccess,
  sendError
};

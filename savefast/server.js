const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { PORT, NODE_ENV, ALLOWED_ORIGINS } = require('./src/config/env');

const loggerMiddleware = require('./src/middlewares/logger');
const errorHandler = require('./src/middlewares/error');
const apiRouter = require('./src/routes/api');

const app = express();

// Set security headers using Helmet
app.use(helmet());

// Configure CORS Whitelist dynamically
const corsOptions = {
  origin: (origin, callback) => {
    // Allow request with no origin (like mobile apps, curl, or server-to-server)
    if (!origin) return callback(null, true);
    
    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    } else {
      console.warn(`[CORS Request Blocked] Origin: ${origin}`);
      return callback(new Error('Blocked by CORS policy: Origin unauthorized.'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

// Request logger middleware
app.use(loggerMiddleware);

// JSON body parser with limit sizes mapping
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Health Check route directly at server level
app.get('/health', (req, res) => {
  res.redirect('/api/health');
});

// Bind API Routing endpoints
app.use('/api', apiRouter);

// Standard root redirect
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Welcome to SaveFast.in API services.',
    docs: 'Refer to repository readme files for parameter settings.'
  });
});

// 404 handler for unmatched routes
app.use((req, res, next) => {
  const err = new Error(`Resource endpoint '${req.originalUrl}' not found.`);
  err.status = 404;
  next(err);
});

// Centralized error handler middleware
app.use(errorHandler);

// Launching the server
const server = app.listen(PORT, () => {
  console.log(`=============================================`);
  console.log(`  SaveFast API Backend Server Running Online `);
  console.log(`  Port: ${PORT} | Mode: ${NODE_ENV}`);
  console.log(`=============================================`);
});

// Handle uncaught exceptions and rejections cleanly
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Promise Rejection detected:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception crash triggered:', error.message);
  server.close(() => {
    process.exit(1);
  });
});

module.exports = app;

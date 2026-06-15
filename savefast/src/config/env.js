const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from root of backend directory
dotenv.config({ path: path.join(__dirname, '../../.env') });

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Parse comma-separated list of origins
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5000', 'https://savefast.in'];

const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

if (NODE_ENV === 'production' && !ADMIN_API_KEY) {
  console.error('FATAL ERROR: ADMIN_API_KEY is not defined in production environment variables.');
  process.exit(1);
}

// Firebase SDK credentials config
const firebaseConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID || 'savefast-45e97',
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY 
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : undefined
};

const PROXY_URL = process.env.PROXY_URL;
const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;
const SCRAPER_API_PROVIDER = process.env.SCRAPER_API_PROVIDER || 'scraperapi';

module.exports = {
  PORT,
  NODE_ENV,
  ALLOWED_ORIGINS,
  ADMIN_API_KEY: ADMIN_API_KEY || 'savefast-dev-secret-key',
  firebaseConfig,
  PROXY_URL,
  SCRAPER_API_KEY,
  SCRAPER_API_PROVIDER
};

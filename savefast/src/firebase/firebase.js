const admin = require('firebase-admin');
const { firebaseConfig, NODE_ENV } = require('../config/env');

try {
  if (firebaseConfig.clientEmail && firebaseConfig.privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: firebaseConfig.projectId,
        clientEmail: firebaseConfig.clientEmail,
        privateKey: firebaseConfig.privateKey
      })
    });
    console.log('Firebase Admin SDK initialized successfully via Service Account credentials.');
  } else {
    // If running in GCP environment or firebase CLI local emulator environment, initializeApp() works automatically
    admin.initializeApp();
    console.log('Firebase Admin SDK initialized using default application environment parameters.');
  }
} catch (error) {
  console.warn('Firebase Admin SDK initialization warning:', error.message);
  if (NODE_ENV === 'production') {
    console.error('FATAL: Firebase Admin SDK credentials are required in production mode.');
    throw error;
  } else {
    console.warn('Using Local Mock/Fallback mode for Firebase operations. Firestore integration may be offline.');
  }
}

const db = admin.apps.length > 0 ? admin.firestore() : null;

module.exports = {
  admin,
  db
};

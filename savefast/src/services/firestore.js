const { db } = require('../firebase/firebase');

/**
 * Log download request details to Firestore downloads collection
 */
async function logDownload({ platform, url, ip, userAgent, status }) {
  if (!db) return null;
  try {
    const docRef = await db.collection('downloads').add({
      platform,
      url,
      ip: ip || 'Unknown',
      userAgent: userAgent || 'Unknown',
      status,
      timestamp: new Date()
    });
    return docRef.id;
  } catch (error) {
    console.error('Firestore logDownload error:', error.message);
    return null;
  }
}

/**
 * Increment or initialize platform-specific analytics counters
 */
async function updateAnalytics(platform, isSuccess) {
  if (!db) return;
  
  // Format today's date slug (YYYY-MM-DD)
  const todayStr = new Date().toISOString().split('T')[0];
  const docId = `${platform}_${todayStr}`;
  const docRef = db.collection('analytics').doc(docId);

  try {
    await db.runTransaction(async (transaction) => {
      const sfDoc = await transaction.get(docRef);
      
      if (!sfDoc.exists) {
        transaction.set(docRef, {
          platform,
          totalRequests: 1,
          successfulRequests: isSuccess ? 1 : 0,
          failedRequests: isSuccess ? 0 : 1,
          date: todayStr
        });
      } else {
        const data = sfDoc.data();
        transaction.update(docRef, {
          totalRequests: (data.totalRequests || 0) + 1,
          successfulRequests: (data.successfulRequests || 0) + (isSuccess ? 1 : 0),
          failedRequests: (data.failedRequests || 0) + (isSuccess ? 0 : 1)
        });
      }
    });
  } catch (error) {
    console.error('Firestore updateAnalytics error:', error.message);
  }
}

/**
 * Get system configurations from settings collection
 */
async function getSettings() {
  if (!db) {
    // Return mock values if Firebase is not linked
    return {
      backendApiUrl: 'http://localhost:3000',
      frontendDomain: 'http://127.0.0.1:3000',
      maintenanceMode: false,
      updatedAt: new Date(),
      updatedBy: 'system-default'
    };
  }

  try {
    const doc = await db.collection('settings').doc('config').get();
    if (doc.exists) {
      return doc.data();
    } else {
      // Set defaults if document is not initialized
      const defaults = {
        backendApiUrl: 'https://api.savefast.in',
        frontendDomain: 'https://savefast.in',
        maintenanceMode: false,
        updatedAt: new Date(),
        updatedBy: 'system-initialization'
      };
      await db.collection('settings').doc('config').set(defaults);
      return defaults;
    }
  } catch (error) {
    console.error('Firestore getSettings error:', error.message);
    throw error;
  }
}

/**
 * Update system configurations inside Firestore settings
 */
async function updateSettings(newSettings, adminUser) {
  if (!db) {
    throw new Error('Firestore database is not connected or initialized.');
  }

  try {
    const configRef = db.collection('settings').doc('config');
    const updatePayload = {
      ...newSettings,
      updatedAt: new Date(),
      updatedBy: adminUser || 'admin'
    };
    await configRef.set(updatePayload, { merge: true });
    return updatePayload;
  } catch (error) {
    console.error('Firestore updateSettings error:', error.message);
    throw error;
  }
}

module.exports = {
  logDownload,
  updateAnalytics,
  getSettings,
  updateSettings
};

const { resolveScrape } = require('../services/scraperBridge');
const { logDownload, updateAnalytics } = require('../services/firestore');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * POST /api/download
 * Main endpoint processing URL downloads
 */
const downloadMedia = async (req, res, next) => {
  const { sanitizedUrl, detectedPlatform } = req;
  const ip = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
  const userAgent = req.headers['user-agent'] || 'Unknown';

  try {
    const result = await resolveScrape(detectedPlatform, sanitizedUrl);
    
    // Log success database records and statistics counters asynchronously
    logDownload({
      platform: detectedPlatform,
      url: sanitizedUrl,
      ip,
      userAgent,
      status: 'success'
    }).catch(err => console.error('Failed to log success download in database:', err.message));

    updateAnalytics(detectedPlatform, true).catch(err => 
      console.error('Failed to update success analytics:', err.message)
    );

    return sendSuccess(res, {
      platform: detectedPlatform,
      title: result.title || '',
      thumbnail: result.thumbnail || '',
      duration: result.duration || '',
      formats: result.formats || []
    });
  } catch (error) {
    // Log failure log database records
    logDownload({
      platform: detectedPlatform,
      url: sanitizedUrl,
      ip,
      userAgent,
      status: 'failed'
    }).catch(err => console.error('Failed to log failed download in database:', err.message));

    updateAnalytics(detectedPlatform, false).catch(err => 
      console.error('Failed to update failed analytics:', err.message)
    );

    // Pipe error to global Express error handler
    next(error);
  }
};

/**
 * POST /api/info
 * Retrieves metadata details of a media resource without initiating full processing
 */
const getMediaInfo = async (req, res, next) => {
  const { sanitizedUrl, detectedPlatform } = req;
  try {
    const result = await resolveScrape(detectedPlatform, sanitizedUrl);
    return sendSuccess(res, {
      platform: detectedPlatform,
      title: result.title || '',
      thumbnail: result.thumbnail || '',
      duration: result.duration || '',
      formatsCount: (result.formats || []).length
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  downloadMedia,
  getMediaInfo
};

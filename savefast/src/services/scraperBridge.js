const { getFinalUrl, MediaResolveError, fetchWithRetry } = require('./scraperUtils');

// In-memory cache map
const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes cache TTL


// Platform module imports
const instagram = require('./instagram');
const facebook = require('./facebook');
const pinterest = require('./pinterest');
const twitter = require('./twitter');
const threads = require('./threads');
const snapchat = require('./snapchat');

const PLATFORM_SERVICES = {
  instagram,
  facebook,
  pinterest,
  x: twitter,
  twitter,
  threads,
  snapchat
};

async function resolveScrape(platform, url) {
  // Resolve short links first
  const finalUrl = await getFinalUrl(url);
  
  // Re-detect platform dynamically based on finalUrl
  const { detectPlatform } = require('../validators/url');
  const finalPlatform = detectPlatform(finalUrl) || platform;

  // Check Cache with final resolved URL
  const cacheKey = `${finalPlatform}:${finalUrl}`;
  const cachedVal = cache.get(cacheKey);
  if (cachedVal && (Date.now() - cachedVal.timestamp < CACHE_TTL)) {
    console.log(`[Cache Hit] Platform: ${finalPlatform} - Url: ${finalUrl}`);
    return cachedVal.data;
  }

  const service = PLATFORM_SERVICES[finalPlatform.toLowerCase()];
  if (!service) {
    throw new MediaResolveError(`Unsupported platform resolver: ${finalPlatform}`, 400);
  }

  console.log(`[Scraper Bridge] Querying platform: ${finalPlatform} for URL: ${finalUrl} (Original: ${url})`);
  const result = await service.resolve(finalUrl);

  if (!result || !result.formats || result.formats.length === 0) {
    throw new MediaResolveError('Media could not be resolved.', 404);
  }

  // Cache successful responses
  cache.set(cacheKey, { timestamp: Date.now(), data: result });
  return result;
}

module.exports = {
  resolveScrape,
  fetchWithRetry,
  MediaResolveError,
  getFinalUrl
};

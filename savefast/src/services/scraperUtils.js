const axios = require('axios');

// Custom Error class for classified media failures
class MediaResolveError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'MediaResolveError';
    this.status = status;
  }
}

// Global user-agents pool for rotation
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1'
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Axios fetch helper with retry limits and agent rotation
 */
async function fetchWithRetry(url, options = {}, retries = 2, delay = 1000) {
  const headers = {
    'User-Agent': getRandomUserAgent(),
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    ...options.headers
  };

  for (let i = 0; i <= retries; i++) {
    try {
      return await axios.get(url, { ...options, headers });
    } catch (err) {
      if (i === retries) throw err;
      console.warn(`[Scraper Retry] Failed request to ${url}. Retrying in ${delay}ms... (${i + 1}/${retries}). Error: ${err.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function getFinalUrl(url) {
  try {
    const res = await axios.get(url, {
      maxRedirects: 5,
      timeout: 5000,
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      }
    });
    return res.request.res.responseUrl || res.request.responseURL || url;
  } catch (err) {
    console.warn('[Scraper Bridge] Redirect follow warning:', err.message);
    return url;
  }
}

module.exports = {
  MediaResolveError,
  fetchWithRetry,
  getFinalUrl,
  getRandomUserAgent
};

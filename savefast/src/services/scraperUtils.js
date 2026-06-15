const axios = require('axios');
const { PROXY_URL, SCRAPER_API_KEY, SCRAPER_API_PROVIDER } = require('../config/env');

// Setup Proxy Agent dynamically if PROXY_URL is set
let proxyAgent = null;
if (PROXY_URL) {
  try {
    const HttpsProxyAgentClass = require('https-proxy-agent').HttpsProxyAgent;
    proxyAgent = new HttpsProxyAgentClass(PROXY_URL);
    console.log('[Scraper Proxy] Dynamic Proxy Agent initialized successfully.');
  } catch (e) {
    console.warn('[Scraper Proxy Warning] https-proxy-agent module not found. Falling back to native Axios proxy configs.');
  }
}

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
 * Axios fetch helper with retry limits, agent rotation, proxy support and Scraper API routing
 */
async function fetchWithRetry(url, options = {}, retries = 2, delay = 1000) {
  let requestUrl = url;
  const requestOptions = { ...options };

  // If Scraper API key is set, route request through Scraper API
  if (SCRAPER_API_KEY) {
    const encodedUrl = encodeURIComponent(url);
    if (SCRAPER_API_PROVIDER === 'scrapingbee') {
      requestUrl = `https://app.scrapingbee.com/api/v1/?api_key=${SCRAPER_API_KEY}&url=${encodedUrl}`;
    } else {
      requestUrl = `https://api.scraperapi.com/?api_key=${SCRAPER_API_KEY}&url=${encodedUrl}`;
    }
  } else if (proxyAgent) {
    requestOptions.httpsAgent = proxyAgent;
    requestOptions.httpAgent = proxyAgent;
  } else if (PROXY_URL) {
    // Parse Axios native proxy configurations
    try {
      const urlObj = new URL(PROXY_URL);
      requestOptions.proxy = {
        protocol: urlObj.protocol.replace(':', ''),
        host: urlObj.hostname,
        port: parseInt(urlObj.port),
        auth: urlObj.username ? { username: urlObj.username, password: urlObj.password } : undefined
      };
    } catch (err) {
      console.warn('[Proxy Config Error] Failed parsing native proxy configuration:', err.message);
    }
  }

  const headers = {
    'User-Agent': getRandomUserAgent(),
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    ...options.headers
  };

  for (let i = 0; i <= retries; i++) {
    try {
      return await axios.get(requestUrl, { ...requestOptions, headers });
    } catch (err) {
      if (i === retries) throw err;
      console.warn(`[Scraper Retry] Failed request to ${url}. Retrying in ${delay}ms... (${i + 1}/${retries}). Error: ${err.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function getFinalUrl(url) {
  const requestOptions = {
    maxRedirects: 5,
    timeout: 5000,
    headers: {
      'User-Agent': getRandomUserAgent(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    }
  };

  // Route redirects checks through proxy or Scraper API if enabled
  let requestUrl = url;
  if (SCRAPER_API_KEY) {
    const encodedUrl = encodeURIComponent(url);
    if (SCRAPER_API_PROVIDER === 'scrapingbee') {
      requestUrl = `https://app.scrapingbee.com/api/v1/?api_key=${SCRAPER_API_KEY}&url=${encodedUrl}`;
    } else {
      requestUrl = `https://api.scraperapi.com/?api_key=${SCRAPER_API_KEY}&url=${encodedUrl}`;
    }
  } else if (proxyAgent) {
    requestOptions.httpsAgent = proxyAgent;
    requestOptions.httpAgent = proxyAgent;
  } else if (PROXY_URL) {
    try {
      const urlObj = new URL(PROXY_URL);
      requestOptions.proxy = {
        protocol: urlObj.protocol.replace(':', ''),
        host: urlObj.hostname,
        port: parseInt(urlObj.port),
        auth: urlObj.username ? { username: urlObj.username, password: urlObj.password } : undefined
      };
    } catch (err) {}
  }

  try {
    const res = await axios.get(requestUrl, requestOptions);
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

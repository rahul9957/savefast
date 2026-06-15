/**
 * URL validation and platform detection utility module
 */

const PLATFORM_PATTERNS = {
  instagram: /^(https?:\/\/)?(www\.)?instagram\.com\/(p|tv|reel|reels|stories)\/([^/?#&]+)/i,
  facebook: /^(https?:\/\/)?(www\.)?(facebook\.com|fb\.watch|fb\.gg)\/.*$/i,
  pinterest: /^(https?:\/\/)?(pin\.it|([a-z0-9]+)?\.?pinterest\.(com|co\.[a-z]{2}|[a-z]{2}))/i,
  x: /^(https?:\/\/)?(www\.)?(twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/status\/(\d+)/i,
  threads: /^(https?:\/\/)?(www\.)?threads\.net\/(t\/|@[a-zA-Z0-9_.-]+\/post\/)([^/?#&]+)/i,
  snapchat: /^(https?:\/\/)?(www\.)?(t\.snapchat\.com|snapchat\.com)/i
};

// URL sanitizer to prevent XSS/injection strings
function sanitizeUrl(url) {
  if (typeof url !== 'string') return '';
  return url.trim().replace(/[<>'"\s]/g, '');
}

function detectPlatform(url) {
  const sanitized = sanitizeUrl(url);
  for (const [platform, pattern] of Object.entries(PLATFORM_PATTERNS)) {
    if (pattern.test(sanitized)) {
      return platform;
    }
  }
  return null;
}

const urlValidator = (req, res, next) => {
  const { url } = req.body || {};

  if (!url) {
    return res.status(400).json({
      success: false,
      message: 'Body parameter "url" is required.'
    });
  }

  const sanitizedUrl = sanitizeUrl(url);
  
  // Basic absolute URL format check
  try {
    new URL(sanitizedUrl);
  } catch (e) {
    return res.status(400).json({
      success: false,
      message: 'Invalid URL format structure.'
    });
  }

  const platform = detectPlatform(sanitizedUrl);

  if (!platform) {
    return res.status(400).json({
      success: false,
      message: 'Unsupported social media URL platform. Please provide a link from Instagram, Facebook, Pinterest, X, Threads, or Snapchat.'
    });
  }

  // Attach detected platform and sanitized url to request context
  req.detectedPlatform = platform;
  req.sanitizedUrl = sanitizedUrl;
  next();
};

module.exports = {
  urlValidator,
  detectPlatform,
  sanitizeUrl
};

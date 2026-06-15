const { fetchWithRetry } = require('./scraperUtils');
const axios = require('axios');
const { PROXY_URL, SCRAPER_API_KEY } = require('../config/env');

function cleanJsonString(str) {
  try {
    return JSON.parse(`"${str}"`);
  } catch (e) {
    return str.replace(/\\u002F/g, '/').replace(/\\//g, '/').replace(/\\u0026/g, '&').replace(/&amp;/g, '&');
  }
}

async function resolve(url) {
  if (!SCRAPER_API_KEY && !PROXY_URL) {
    console.warn('[Instagram Scraper Warning] Both SCRAPER_API_KEY and PROXY_URL are undefined. Requests from cloud environments like Render will likely fail due to Instagram blocks. Please configure SCRAPER_API_KEY in environment settings.');
  }

  try {
    // 1. Try the public /embed/ method first (highest rate-limit resistance for public content)
    let embedUrl = url;
    try {
      const urlObj = new URL(url);
      urlObj.search = '';
      const cleanPath = urlObj.pathname.replace(/\/$/, '');
      embedUrl = `${urlObj.origin}${cleanPath}/embed/`;
    } catch (e) {
      embedUrl = url.endsWith('/') ? `${url}embed/` : `${url}/embed/`;
    }

    try {
      const response = await fetchWithRetry(embedUrl, { timeout: 6000 });
      const html = response.data;

      // Scan for JSON parameters inside the embed scripts
      const videoRegex = /"video_url":"([^"]+)"/i;
      const displayUrlRegex = /"display_url":"([^"]+)"/i;
      const captionRegex = /"caption":"([^"]+)"/i;

      const videoMatch = html.match(videoRegex);
      const displayMatch = html.match(displayUrlRegex);
      const captionMatch = html.match(captionRegex);

      if (videoMatch && videoMatch[1]) {
        const videoUrl = decodeURIComponent(cleanJsonString(videoMatch[1]));
        const displayUrl = displayMatch ? decodeURIComponent(cleanJsonString(displayMatch[1])) : '';
        const title = captionMatch ? decodeURIComponent(cleanJsonString(captionMatch[1])) : 'Instagram Video';

        return {
          title: title.slice(0, 100) || 'Instagram Video',
          thumbnail: displayUrl,
          duration: '00:00',
          formats: [
            { quality: 'High Definition (HD)', extension: 'mp4', url: videoUrl }
          ]
        };
      }
      
      // Image post fallback inside embed
      const displayMatches = [...html.matchAll(/"display_url":"([^"]+)"/gi)];
      if (displayMatches.length > 0) {
        const imageUrl = decodeURIComponent(cleanJsonString(displayMatches[displayMatches.length - 1][1]));
        return {
          title: 'Instagram Post Image',
          thumbnail: imageUrl,
          duration: '00:00',
          formats: [
            { quality: 'Original Quality', extension: 'jpg', url: imageUrl }
          ]
        };
      }
    } catch (embedErr) {
      console.warn('[Instagram Scraper] Embed method parsing failed, trying fallback:', embedErr.message);
    }

    // 2. Fallback method: Scrape main page source
    try {
      const response = await fetchWithRetry(url, { timeout: 6000 });
      const html = response.data;

      // Schema Parser
      const ldJsonRegex = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/i;
      const ldMatch = html.match(ldJsonRegex);
      if (ldMatch && ldMatch[1]) {
        try {
          const data = JSON.parse(ldMatch[1]);
          if (data.video && data.video.contentUrl) {
            return {
              title: data.name || 'Instagram Video',
              thumbnail: data.image || '',
              duration: data.video.duration || '00:00',
              formats: [
                { quality: 'Direct Video Stream', extension: 'mp4', url: data.video.contentUrl }
              ]
            };
          }
        } catch (parseErr) {
          console.warn('[Instagram Scraper] Schema parse failed:', parseErr.message);
        }
      }

      // OpenGraph Scraper
      const ogVideoRegex = /<meta property="og:video" content="([^"]+)"/i;
      const ogImageRegex = /<meta property="og:image" content="([^"]+)"/i;
      const ogTitleRegex = /<meta property="og:title" content="([^"]+)"/i;

      const videoMatch = html.match(ogVideoRegex);
      if (videoMatch && videoMatch[1]) {
        return {
          title: html.match(ogTitleRegex) ? html.match(ogTitleRegex)[1] : 'Instagram Content',
          thumbnail: html.match(ogImageRegex) ? html.match(ogImageRegex)[1].replace(/&amp;/g, '&') : '',
          duration: '00:00',
          formats: [{ quality: 'Direct Video Link', extension: 'mp4', url: videoMatch[1].replace(/&amp;/g, '&') }]
        };
      }
    } catch (pageErr) {
      console.warn('[Instagram Scraper] Page scrape failed, trying API fallback:', pageErr.message);
    }

    // 3. API Fallback using backend1.tioo.eu.org/igdl
    console.log('[Instagram Scraper] Requesting fallback API...');
    const apiRes = await fetchWithRetry(`https://backend1.tioo.eu.org/igdl?url=${encodeURIComponent(url)}`, { timeout: 8000 });
    
    let resData = null;
    if (apiRes && apiRes.data) {
      if (Array.isArray(apiRes.data)) {
        resData = apiRes.data;
      } else if (apiRes.data.result) {
        resData = apiRes.data.result;
      } else if (apiRes.data.status && Array.isArray(apiRes.data.data)) {
        resData = apiRes.data.data;
      }
    }

    if (resData && resData.length > 0) {
      const formats = resData.map((item, idx) => {
        const mediaUrl = typeof item === 'string' ? item : (item.url || item.url_download);
        if (!mediaUrl) return null;

        let isVideo = false;
        try {
          if (mediaUrl.includes('token=')) {
            const token = mediaUrl.split('token=')[1].split('&')[0];
            const parts = token.split('.');
            if (parts.length === 3) {
              const payload = parts[1];
              const decoded = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
              const innerUrl = decoded.url || '';
              const filename = decoded.filename || '';
              isVideo = innerUrl.includes('.mp4') || filename.includes('.mp4') || decoded.type === 'video';
            }
          }
        } catch (jwtErr) {
          console.warn('[Instagram Scraper] Failed to decode JWT token from mediaUrl:', jwtErr.message);
        }

        if (!isVideo) {
          const filename = item.filename || '';
          isVideo = mediaUrl.includes('.mp4') || mediaUrl.includes('/v/') || mediaUrl.includes('cdninstagram.com') || filename.includes('.mp4') || item.type === 'video';
        }
        
        return {
          quality: isVideo ? `High Definition HD (Format ${idx + 1})` : `Original Quality (Format ${idx + 1})`,
          extension: isVideo ? 'mp4' : 'jpg',
          url: mediaUrl
        };
      }).filter(Boolean);

      if (formats.length > 0) {
        return {
          title: 'Instagram Post Media',
          thumbnail: (resData[0] && resData[0].thumbnail) || (resData[0] && resData[0].url) || url,
          duration: '00:00',
          formats
        };
      }
    }
  } catch (error) {
    console.error('[Instagram service] Resolve error:', error.message);
    if (!SCRAPER_API_KEY && !PROXY_URL) {
      console.warn('[Instagram service Suggestion] Instagram blocks unproxied cloud server IPs. Please set up a PROXY_URL or SCRAPER_API_KEY in Render environment variables to enable reliable downloading.');
    }
  }

  return null;
}

module.exports = { resolve };

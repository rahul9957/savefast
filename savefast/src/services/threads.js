const { fetchWithRetry } = require('./scraperUtils');
const axios = require('axios');

function cleanJsonString(str) {
  try {
    return JSON.parse(`"${str}"`);
  } catch (e) {
    return str.replace(/\\u002F/g, '/').replace(/\\//g, '/').replace(/\\u0026/g, '&').replace(/&amp;/g, '&');
  }
}

async function resolve(url) {
  try {
    // 1. Try public /embed/ method first (highest consistency for public Threads posts)
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

      // Extract JSON parameters inside embed scripts
      const videoRegex = /"video_url":"([^"]+)"/i;
      const displayUrlRegex = /"display_url":"([^"]+)"/i;
      const captionRegex = /"caption":"([^"]+)"/i;

      const videoMatch = html.match(videoRegex);
      const displayMatch = html.match(displayUrlRegex);
      const captionMatch = html.match(captionRegex);

      if (videoMatch && videoMatch[1]) {
        const videoUrl = decodeURIComponent(cleanJsonString(videoMatch[1]));
        const displayUrl = displayMatch ? decodeURIComponent(cleanJsonString(displayMatch[1])) : '';
        const title = captionMatch ? decodeURIComponent(cleanJsonString(captionMatch[1])) : 'Threads Video';

        return {
          title: title.slice(0, 100) || 'Threads Video',
          thumbnail: displayUrl,
          duration: '00:00',
          formats: [
            { quality: 'Original Quality', extension: 'mp4', url: videoUrl }
          ]
        };
      }
      
      const displayMatches = [...html.matchAll(/"display_url":"([^"]+)"/gi)];
      if (displayMatches.length > 0) {
        const imageUrl = decodeURIComponent(cleanJsonString(displayMatches[displayMatches.length - 1][1]));
        return {
          title: 'Threads Image',
          thumbnail: imageUrl,
          duration: '00:00',
          formats: [
            { quality: 'Original Quality', extension: 'jpg', url: imageUrl }
          ]
        };
      }
    } catch (embedErr) {
      console.warn('[Threads Scraper] Embed method error, trying fallback:', embedErr.message);
    }

    // 2. Fallback: Parse standard page meta tags
    try {
      const response = await fetchWithRetry(url, { timeout: 6000 });
      const html = response.data;

      const ogVideoRegex = /<meta property="og:video" content="([^"]+)"/i;
      const ogImageRegex = /<meta property="og:image" content="([^"]+)"/i;
      const ogTitleRegex = /<meta property="og:title" content="([^"]+)"/i;

      const videoMatch = html.match(ogVideoRegex);
      if (videoMatch && videoMatch[1]) {
        return {
          title: html.match(ogTitleRegex) ? html.match(ogTitleRegex)[1] : 'Threads Video Post',
          thumbnail: html.match(ogImageRegex) ? html.match(ogImageRegex)[1].replace(/&amp;/g, '&') : '',
          duration: '00:00',
          formats: [{ quality: 'Direct Video Stream', extension: 'mp4', url: videoMatch[1].replace(/&amp;/g, '&') }]
        };
      }
    } catch (pageErr) {
      console.warn('[Threads Scraper] Standard page scrape failed, trying API fallback:', pageErr.message);
    }

    // 3. API Fallback using backend1.tioo.eu.org/threads
    try {
      console.log('[Threads Scraper] Requesting fallback API...');
      const apiRes = await axios.get(`https://backend1.tioo.eu.org/threads?url=${encodeURIComponent(url)}`, { timeout: 8000 });
      
      if (apiRes.data && apiRes.data.status && apiRes.data.result) {
        const resData = apiRes.data.result;
        // The API returns metadata and media in some formats, let's parse it safely
        const formats = [];
        if (resData.video && resData.video.length > 0) {
          resData.video.forEach((v, idx) => {
            formats.push({ quality: `Video Stream (Quality ${idx + 1})`, extension: 'mp4', url: v.url || v });
          });
        }
        if (resData.image && resData.image.length > 0) {
          resData.image.forEach((img, idx) => {
            formats.push({ quality: `Image Resolution (Format ${idx + 1})`, extension: 'jpg', url: img.url || img });
          });
        }

        if (formats.length > 0) {
          return {
            title: resData.title || 'Threads Media',
            thumbnail: resData.thumbnail || (resData.image && resData.image[0]) || '',
            duration: '00:00',
            formats
          };
        }
      }
    } catch (apiErr) {
      console.warn('[Threads Scraper] Fallback API request failed:', apiErr.message);
    }
  } catch (error) {
    console.error('[Threads service] Scrape execution error:', error.message);
  }

  return null;
}

module.exports = { resolve };

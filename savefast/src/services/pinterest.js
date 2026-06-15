const { fetchWithRetry } = require('./scraperUtils');
const axios = require('axios');

function findMediaInObject(obj, results = { videos: [], images: [], title: '' }) {
  if (!obj || typeof obj !== 'object') return results;

  if (obj.title && typeof obj.title === 'string' && !results.title) {
    results.title = obj.title;
  }
  if (obj.headline && typeof obj.headline === 'string' && !results.title) {
    results.title = obj.headline;
  }

  if (obj.video_list && typeof obj.video_list === 'object') {
    const list = obj.video_list;
    for (const key of Object.keys(list)) {
      if (list[key] && list[key].url) {
        results.videos.push({
          quality: key,
          url: list[key].url
        });
      }
    }
  }

  if (obj.images && obj.images.orig && obj.images.orig.url) {
    results.images.push(obj.images.orig.url);
  }

  if (obj.url && typeof obj.url === 'string' && obj.width && obj.height) {
    if (obj.url.includes('/originals/')) {
      results.images.push(obj.url);
    }
  }

  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') {
      findMediaInObject(value, results);
    }
  }
  return results;
}

async function resolve(url) {
  try {
    // Layer 1: Try direct page scraping
    try {
      const response = await fetchWithRetry(url, { timeout: 6000 });
      const html = response.data;

      // 1. Try parsing JSON-LD schemas
      const jsonLdRegex = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
      let ldMatch;
      while ((ldMatch = jsonLdRegex.exec(html)) !== null) {
        try {
          const data = JSON.parse(ldMatch[1]);
          const type = data['@type'];
          
          if (type === 'SocialMediaPosting' || type === 'VideoObject' || type === 'ImageObject') {
            if (data.video && data.video.contentUrl) {
              return {
                title: data.name || data.headline || 'Pinterest Video Pin',
                thumbnail: data.image || '',
                duration: data.video.duration || '00:00',
                formats: [{ quality: 'Original HD Video', extension: 'mp4', url: data.video.contentUrl }]
              };
            }
            const imgUrl = typeof data.image === 'string' ? data.image : (data.image && (data.image.url || data.image[0]));
            if (imgUrl) {
              return {
                title: data.name || data.headline || 'Pinterest Image Pin',
                thumbnail: imgUrl,
                duration: '00:00',
                formats: [{ quality: 'Original HD Image', extension: 'jpg', url: imgUrl }]
              };
            }
          }
        } catch (e) {}
      }

      // 2. Try parsing PWS script blocks with recursive search fallback
      const scriptRegex = /<script id="__PWS_(?:DATA|INITIAL_PROPS)__" type="application\/json">([\s\S]*?)<\/script>/gi;
      let match;
      while ((match = scriptRegex.exec(html)) !== null) {
        try {
          const parsed = JSON.parse(match[1]);
          const results = findMediaInObject(parsed);
          
          if (results.videos.length > 0) {
            return {
              title: results.title || 'Pinterest Video Pin',
              thumbnail: results.images[0] || '',
              duration: '00:00',
              formats: results.videos.map(v => ({
                quality: v.quality || 'Original HD Video',
                extension: 'mp4',
                url: v.url
              }))
            };
          }
          if (results.images.length > 0) {
            return {
              title: results.title || 'Pinterest Image Pin',
              thumbnail: results.images[0],
              duration: '00:00',
              formats: [{ quality: 'Original HD Image', extension: 'jpg', url: results.images[0] }]
            };
          }
        } catch (parseErr) {}
      }

      // 3. Fallback: Parse og metadata tags
      const ogVideoRegex = /<meta property="og:video" content="([^"]+)"/i;
      const ogImageRegex = /<meta property="og:image" content="([^"]+)"/i;
      const ogTitleRegex = /<meta property="og:title" content="([^"]+)"/i;

      const videoMatch = html.match(ogVideoRegex);
      const imageMatch = html.match(ogImageRegex);
      const titleMatch = html.match(ogTitleRegex);

      if (videoMatch && videoMatch[1]) {
        return {
          title: titleMatch ? titleMatch[1] : 'Pinterest Video Pin',
          thumbnail: imageMatch ? imageMatch[1] : '',
          duration: '00:00',
          formats: [{ quality: 'Pinterest Direct Video', extension: 'mp4', url: videoMatch[1] }]
        };
      } else if (imageMatch && imageMatch[1]) {
        return {
          title: titleMatch ? titleMatch[1] : 'Pinterest Image Pin',
          thumbnail: imageMatch[1],
          duration: '00:00',
          formats: [{ quality: 'Pinterest Direct Image', extension: 'jpg', url: imageMatch[1] }]
        };
      }
    } catch (scrapeErr) {
      console.warn('[Pinterest Scraper] Direct scrape failed, trying API fallback:', scrapeErr.message);
    }

    // Layer 2: API Fallback using backend1.tioo.eu.org
    console.log('[Pinterest Scraper] Requesting fallback API...');
    const apiRes = await fetchWithRetry(`https://backend1.tioo.eu.org/pinterest?url=${encodeURIComponent(url)}`, { timeout: 8000 });
    
    if (apiRes.data && apiRes.data.success && apiRes.data.result) {
      const resData = apiRes.data.result;
      const title = resData.title || resData.description || 'Pinterest Pin';
      const thumbnail = resData.image || (resData.images && resData.images.orig && resData.images.orig.url) || '';
      
      const formats = [];
      if (resData.video_url) {
        formats.push({ quality: 'Original HD Video', extension: 'mp4', url: resData.video_url });
      } else if (resData.videos && resData.videos.video_list) {
        const list = resData.videos.video_list;
        for (const key of Object.keys(list)) {
          if (list[key] && list[key].url) {
            formats.push({ quality: key, extension: 'mp4', url: list[key].url });
          }
        }
      }

      // If no video found, fallback to original image
      if (formats.length === 0) {
        const imgUrl = resData.image || (resData.images && resData.images.orig && resData.images.orig.url);
        if (imgUrl) {
          formats.push({ quality: 'Original HD Image', extension: 'jpg', url: imgUrl });
        }
      }

      if (formats.length > 0) {
        return {
          title: title.trim(),
          thumbnail: thumbnail,
          duration: '00:00',
          formats
        };
      }
    }
  } catch (error) {
    console.error('[Pinterest service] Scrape execution error:', error.message);
  }

  return null;
}

module.exports = { resolve };

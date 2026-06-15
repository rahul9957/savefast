const { fetchWithRetry } = require('./scraperUtils');
const axios = require('axios');

async function resolve(url) {
  try {
    // 1. Try querying the video plugin wrapper (very reliable for bypassing rate limits)
    const pluginUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}`;
    
    try {
      const response = await fetchWithRetry(pluginUrl, { timeout: 6000 });
      const html = response.data;
      
      const formats = [];
      
      // Look for playable URL keys in scripts
      const hdRegex = /"playable_url_quality_hd":"([^"]+)"/i;
      const sdRegex = /"playable_url":"([^"]+)"/i;

      const hdMatch = html.match(hdRegex);
      const sdMatch = html.match(sdRegex);

      if (hdMatch || sdMatch) {
        const ogImageRegex = /<meta property="og:image" content="([^"]+)"/i;
        const ogTitleRegex = /<meta property="og:title" content="([^"]+)"/i;
        
        const ogImageMatch = html.match(ogImageRegex);
        const ogTitleMatch = html.match(ogTitleRegex);
        
        const thumbnail = ogImageMatch ? ogImageMatch[1].replace(/&amp;/g, '&') : '';
        const title = ogTitleMatch ? ogTitleMatch[1] : 'Facebook Video';

        if (hdMatch) {
          const hdUrl = decodeURIComponent(JSON.parse(`"${hdMatch[1]}"`));
          formats.push({ quality: 'High Quality HD (720p/1080p)', extension: 'mp4', url: hdUrl });
        }
        if (sdMatch) {
          const sdUrl = decodeURIComponent(JSON.parse(`"${sdMatch[1]}"`));
          formats.push({ quality: 'Standard Quality SD', extension: 'mp4', url: sdUrl });
        }

        return {
          title,
          thumbnail,
          duration: '00:00',
          formats
        };
      }
    } catch (pluginErr) {
      console.warn('[Facebook Scraper] Plugin method error, trying standard page scrape:', pluginErr.message);
    }

    // 2. Scrape main Facebook page
    try {
      const response = await fetchWithRetry(url, { timeout: 6000 });
      const html = response.data;

      // Search common HD/SD parameter formats
      const patterns = [
        { key: /"browser_native_hd_url":"([^"]+)"/i, label: 'HD quality' },
        { key: /"browser_native_sd_url":"([^"]+)"/i, label: 'SD quality' },
        { key: /"hd_src":"([^"]+)"/i, label: 'HD source' },
        { key: /"sd_src":"([^"]+)"/i, label: 'SD source' }
      ];

      const formats = [];
      patterns.forEach(p => {
        const match = html.match(p.key);
        if (match && match[1]) {
          try {
            const cleanUrl = decodeURIComponent(JSON.parse(`"${match[1]}"`));
            formats.push({ quality: p.label, extension: 'mp4', url: cleanUrl });
          } catch (e) {}
        }
      });

      const ogImageRegex = /<meta property="og:image" content="([^"]+)"/i;
      const ogTitleRegex = /<meta property="og:title" content="([^"]+)"/i;
      
      const ogImageMatch = html.match(ogImageRegex);
      const ogTitleMatch = html.match(ogTitleRegex);
      
      const thumbnail = ogImageMatch ? ogImageMatch[1].replace(/&amp;/g, '&') : '';
      const title = ogTitleMatch ? ogTitleMatch[1] : 'Facebook Video';

      if (formats.length > 0) {
        return {
          title,
          thumbnail,
          duration: '00:00',
          formats
        };
      }

      // 3. Fallback to OpenGraph metadata
      const ogVideoRegex = /<meta property="og:video" content="([^"]+)"/i;
      const videoMatch = html.match(ogVideoRegex);
      if (videoMatch && videoMatch[1]) {
        return {
          title,
          thumbnail,
          duration: '00:00',
          formats: [{ quality: 'Direct Video Stream', extension: 'mp4', url: videoMatch[1].replace(/&amp;/g, '&') }]
        };
      }
    } catch (pageErr) {
      console.warn('[Facebook Scraper] Main page scrape failed, trying API fallback:', pageErr.message);
    }

    // 3. API Fallback using backend1.tioo.eu.org/fbdown
    console.log('[Facebook Scraper] Requesting fallback API...');
    const apiRes = await fetchWithRetry(`https://backend1.tioo.eu.org/fbdown?url=${encodeURIComponent(url)}`, { timeout: 8000 });
    
    if (apiRes.data && apiRes.data.status) {
      const resData = apiRes.data;
      const formats = [];
      if (resData.HD) {
        formats.push({ quality: 'High Quality HD (720p/1080p)', extension: 'mp4', url: resData.HD });
      }
      if (resData.Normal_video) {
        formats.push({ quality: 'Standard Quality SD', extension: 'mp4', url: resData.Normal_video });
      }

      if (formats.length > 0) {
        return {
          title: 'Facebook Video',
          thumbnail: '',
          duration: '00:00',
          formats
        };
      }
    }
  } catch (error) {
    console.error('[Facebook service] Scrape execution error:', error.message);
  }

  return null;
}

module.exports = { resolve };

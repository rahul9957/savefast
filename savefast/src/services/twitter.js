const { fetchWithRetry } = require('./scraperUtils');
const axios = require('axios');

async function resolve(url) {
  try {
    // Normalize x.com URLs to twitter.com for TwitSave compatibility
    const normalizedUrl = url.replace(/^(https?:\/\/)?(www\.)?x\.com/i, 'https://twitter.com');

    // 1. Try resolving using TwitSave public parser (highly reliable for public X/Twitter videos)
    const twitSaveUrl = `https://twitsave.com/info?url=${encodeURIComponent(normalizedUrl)}`;
    
    try {
      const response = await fetchWithRetry(twitSaveUrl, { timeout: 6000 });
      const html = response.data;

      // Extract direct download stream paths
      const downloadRegex = /href="([^"]*twitsave\.com\/download[^"]*)"/i;
      const thumbnailRegex = /<img[^>]*src="([^"]+)"[^>]*alt="thumbnail"/i;
      const titleRegex = /<p[^>]*class="text-gray-600[^>]*>([\s\S]*?)<\/p>/i;

      const downloadMatch = html.match(downloadRegex);
      const thumbnailMatch = html.match(thumbnailRegex);
      const titleMatch = html.match(titleRegex);

      if (downloadMatch && downloadMatch[1]) {
        const videoUrl = downloadMatch[1].replace(/&amp;/g, '&');
        const thumbnailUrl = thumbnailMatch ? thumbnailMatch[1] : '';
        const title = titleMatch ? titleMatch[1].trim().replace(/<[^>]+>/g, '') : 'X / Twitter Video';

        return {
          title: title.slice(0, 100) || 'X / Twitter Video',
          thumbnail: thumbnailUrl,
          duration: '00:00',
          formats: [
            { quality: 'High Definition (HD)', extension: 'mp4', url: videoUrl }
          ]
        };
      }
    } catch (twitErr) {
      console.warn('[Twitter Scraper] TwitSave fallback parsing failed:', twitErr.message);
    }

    // 2. API Fallback using backend1.tioo.eu.org/twitter
    try {
      console.log('[Twitter Scraper] Requesting fallback API...');
      const apiRes = await fetchWithRetry(`https://backend1.tioo.eu.org/twitter?url=${encodeURIComponent(normalizedUrl)}`, { timeout: 8000 });
      
      if (apiRes.data && apiRes.data.status) {
        const resData = apiRes.data;
        if (resData.url) {
          return {
            title: resData.title || 'X / Twitter Video',
            thumbnail: '',
            duration: '00:00',
            formats: [
              { quality: 'High Definition (HD)', extension: 'mp4', url: resData.url }
            ]
          };
        }
      }
    } catch (apiErr) {
      console.warn('[Twitter Scraper] Fallback API request failed:', apiErr.message);
    }

    // 3. Try oEmbed info resolver as secondary metadata resolver
    const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(normalizedUrl)}`;
    const oembedRes = await fetchWithRetry(oembedUrl, { timeout: 4000 });
    
    if (oembedRes.data) {
      const data = oembedRes.data;
      const title = data.author_name ? `Tweet by ${data.author_name}` : 'X / Twitter Post';
      console.warn('[Twitter service] Direct video stream could not be extracted from oEmbed.');
    }
  } catch (error) {
    console.error('[Twitter service] Scrape execution error:', error.message);
  }

  return null; // Return null if unable to resolve (no mock data!)
}

module.exports = { resolve };

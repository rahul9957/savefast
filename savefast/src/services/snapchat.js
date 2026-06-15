const { fetchWithRetry } = require('./scraperUtils');

async function resolve(url) {
  try {
    const response = await fetchWithRetry(url, { timeout: 6000 });
    const html = response.data;

    const ogImageRegex = /<meta property="og:image" content="([^"]+)"/i;
    const ogTitleRegex = /<meta property="og:title" content="([^"]+)"/i;
    
    const ogImageMatch = html.match(ogImageRegex);
    const ogTitleMatch = html.match(ogTitleRegex);
    
    const thumbnail = ogImageMatch ? ogImageMatch[1].replace(/&amp;/g, '&') : '';
    const title = ogTitleMatch ? ogTitleMatch[1] : 'Snapchat Spotlight Video';

    // 1. Try parsing JSON configuration variables (streamingMediaInfo / mediaUrl)
    const mediaUrlRegex = /"mediaUrl":"([^"]+)"/i;
    const snapUrlRegex = /"snapUrl":"([^"]+)"/i;

    const mediaMatch = html.match(mediaUrlRegex);
    const snapMatch = html.match(snapUrlRegex);

    if (mediaMatch || snapMatch) {
      const videoUrl = mediaMatch ? mediaMatch[1] : snapMatch[1];
      const cleanUrl = videoUrl.replace(/\\u002F/g, '/');
      
      return {
        title,
        thumbnail,
        duration: '00:00',
        formats: [
          { quality: 'Original Spotlight Video', extension: 'mp4', url: cleanUrl }
        ]
      };
    }

    // 2. Try parsing CDN direct links via regex search (highly consistent for Snapchat CDNs)
    const cdnRegex = /https?:\/\/cf-st\.sc-cdn\.net\/d\/[^"'\s<>]+/gi;
    const cdnMatches = html.match(cdnRegex);
    if (cdnMatches && cdnMatches.length > 0) {
      // Decode unicode/HTML sequences and clean the best match
      const rawCdnUrl = cdnMatches[0];
      const videoUrl = rawCdnUrl.replace(/\\u002F/g, '/').replace(/&amp;/g, '&');
      
      return {
        title,
        thumbnail,
        duration: '00:00',
        formats: [
          { quality: 'Spotlight CDN Stream', extension: 'mp4', url: videoUrl }
        ]
      };
    }

    // 3. Fallback to OpenGraph metadata tags
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
  } catch (error) {
    console.error('[Snapchat service] Scrape execution error:', error.message);
  }

  return null;
}

module.exports = { resolve };

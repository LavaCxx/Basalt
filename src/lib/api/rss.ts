/**
 * RSS Parser for Douban and other sources
 * Uses native fetch for Cloudflare Workers compatibility
 */

import type { CurrentItem, FeedItem, MediaMetadata } from '../types';

/**
 * Fetch and parse RSS feed using native fetch (Cloudflare Workers compatible)
 */
async function fetchAndParseRSS(url: string): Promise<{ items: any[] }> {
  try {
    console.log('[RSS] Fetching:', url);

    // Extract domain for Referer header
    const urlObj = new URL(url);
    const referer = `${urlObj.protocol}//${urlObj.hostname}/`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Referer': referer,
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const xmlText = await response.text();
    console.log('[RSS] Response length:', xmlText.length);

    // Dynamic import rss-parser for parsing only
    const RSSParser = (await import('rss-parser')).default;
    const parser = new RSSParser({
      customFields: {
        item: ['content', 'encoded', 'description'],
      },
    });

    // Parse from string instead of URL
    const feed = await parser.parseString(xmlText);
    console.log('[RSS] Parsed items:', feed.items?.length || 0);
    return feed;
  } catch (error) {
    console.error(`[RSS] Error fetching from ${url}:`, error);
    throw error;
  }
}

/**
 * Get environment variable (works in both Astro and Node contexts)
 */
const getEnv = (key: string): string | undefined => {
  return (import.meta as any).env?.[key] || process.env[key];
};

/**
 * Douban RSS feed URL patterns
 * 用户动态: https://www.douban.com/feed/people/{userId}/
 * 或者: https://rss.douban.com/user/{userId}/
 */
const DOUBAN_USER_RSS = getEnv('DOUBAN_USER_RSS');

/**
 * Status keywords in Douban RSS
 */
const STATUS_KEYWORDS = {
  reading: ['在读', 'reading'],
  watched: ['看过', 'watched', '看过'],
  watching: ['在看', 'watching'],
  listening: ['在听', 'listening'],
  wantRead: ['想读', 'want to read'],
  wantWatch: ['想看', 'want to watch'],
};

/**
 * Media type detection from title
 */
function detectMediaType(title: string): 'book' | 'movie' | 'music' | 'tv' {
  const lowerTitle = title.toLowerCase();

  // TV shows often have season indicators
  if (/第\s*\d+\s*季|season|s\d+e\d+/i.test(title)) {
    return 'tv';
  }

  // Movies often have year in parentheses
  if (/\(\d{4}\)/.test(title) && !/书|book|著|作者/i.test(title)) {
    return 'movie';
  }

  // Music albums
  if (/专辑|album|唱片|music/i.test(title)) {
    return 'music';
  }

  // Default to book for text-heavy content
  if (/书|book|著|作者|出版社/i.test(title)) {
    return 'book';
  }

  // Default to movie
  return 'movie';
}

/**
 * Parse Douban RSS item to extract media info
 */
function parseDoubanItem(item: any): {
  title: string;
  status: string;
  rating?: number;
  maxRating?: number;
  review?: string;
  cover?: string;
  mediaType: 'book' | 'movie' | 'music' | 'tv';
  date: Date;
} | null {
  const title = item.title || '';
  // Use raw HTML content for image extraction
  const rawContent = item.content || item.description || '';
  const content = item.contentSnippet || rawContent.replace(/<[^>]+>/g, '');
  const pubDate = item.pubDate || item.isoDate ? new Date(item.pubDate || item.isoDate) : new Date();
  const link = item.link || '';

  // Determine media type from link (most reliable)
  let mediaType: 'book' | 'movie' | 'music' | 'tv' = 'movie';
  if (link.includes('book.douban.com')) {
    mediaType = 'book';
  } else if (link.includes('music.douban.com')) {
    mediaType = 'music';
  } else if (link.includes('movie.douban.com')) {
    // Check if it's a TV show from title
    if (/第\s*\d+\s*季|season|s\d+e\d+/i.test(title)) {
      mediaType = 'tv';
    } else {
      mediaType = 'movie';
    }
  }

  // Extract status from title (format: "最近在读: 标题" or "在读 标题")
  let status = 'done';
  let cleanTitle = title;

  for (const [key, keywords] of Object.entries(STATUS_KEYWORDS)) {
    for (const keyword of keywords) {
      if (title.includes(keyword)) {
        status = key;
        // Remove status keyword and common prefixes like "最近"
        cleanTitle = title
          .replace(/最近/, '')
          .replace(keyword, '')
          .replace(/[:：]/, '')
          .trim();
        break;
      }
    }
  }

  // Extract rating (format: "推荐: ★★★★" or "评分: 4/5" or "力荐" etc.)
  let rating: number | undefined;
  let maxRating: number | undefined;

  // Try to match star ratings
  const starMatch = content.match(/推荐[：:]\s*([★☆]{1,5})|([★☆]{1,5})\s*$/m);
  if (starMatch) {
    const stars = starMatch[1] || starMatch[2];
    if (stars) {
      rating = (stars.match(/★/g) || []).length;
      maxRating = 5;
    }
  }

  // Try to match numeric ratings (e.g., "8/10", "4/5")
  if (!rating) {
    const numMatch = content.match(/(\d(?:\.\d)?)\s*[/／]\s*(10|5)/);
    if (numMatch) {
      rating = parseFloat(numMatch[1]);
      maxRating = parseInt(numMatch[2]);
    }
  }

  // Try to match Chinese rating words
  if (!rating) {
    const wordRatings: Record<string, number> = {
      '力荐': 5,
      '推荐': 4,
      '还行': 3,
      '较差': 2,
      '很差': 1,
    };
    for (const [word, score] of Object.entries(wordRatings)) {
      if (content.includes(word)) {
        rating = score;
        maxRating = 5;
        break;
      }
    }
  }

  // Extract cover image from raw HTML content
  let cover: string | undefined;
  const imgMatch = rawContent.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch) {
    // Use our proxy endpoint to bypass Douban's hotlink protection
    const originalUrl = imgMatch[1];
    cover = `/api/proxy-image?url=${encodeURIComponent(originalUrl)}`;
  }

  // Extract review (text after rating)
  let review: string | undefined;
  const reviewMatch = content.replace(/<[^>]+>/g, '').match(/备注[：:]?\s*(.+)|评论[：:]?\s*(.+)/s);
  if (reviewMatch) {
    review = (reviewMatch[1] || reviewMatch[2] || '').trim().slice(0, 200);
  }

  return {
    title: cleanTitle,
    status,
    rating,
    maxRating,
    review,
    cover,
    mediaType,
    date: pubDate,
  };
}

/**
 * Fetch Douban RSS feed
 */
export async function fetchDoubanFeed(): Promise<FeedItem[]> {
  if (!DOUBAN_USER_RSS) {
    console.warn('DOUBAN_USER_RSS is not set, returning empty feed');
    return [];
  }

  try {
    const feed = await fetchAndParseRSS(DOUBAN_USER_RSS);

    const items: FeedItem[] = feed.items
      .map((item) => {
        const parsed = parseDoubanItem(item);
        if (!parsed) return null;

        const metadata: MediaMetadata = {
          mediaType: parsed.mediaType,
          rating: parsed.rating,
          maxRating: parsed.maxRating,
          review: parsed.review,
          status: parsed.status === 'reading' || parsed.status === 'watching' || parsed.status === 'listening'
            ? 'in_progress'
            : parsed.status.includes('want')
              ? 'wishlist'
              : 'completed',
        };

        return {
          id: item.guid || item.link || `douban-${Date.now()}-${Math.random()}`,
          type: 'media' as const,
          title: parsed.title,
          content: parsed.review || '',
          date: parsed.date,
          source: 'douban' as const,
          url: item.link,
          image: parsed.cover,
          metadata,
        };
      })
      .filter((item): item is FeedItem => item !== null)
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    return items;
  } catch (error) {
    console.error('Error fetching Douban RSS:', error);
    return [];
  }
}

/**
 * Get "currently" items (in progress) from Douban
 * Returns items that are currently being consumed (reading, watching, listening)
 */
export async function getCurrentItems(): Promise<CurrentItem[]> {
  if (!DOUBAN_USER_RSS) {
    return [];
  }

  try {
    const feed = await fetchAndParseRSS(DOUBAN_USER_RSS);

    const currentItems: CurrentItem[] = [];

    for (const item of feed.items) {
      const parsed = parseDoubanItem(item);
      if (!parsed) continue;

      // Only include items that are "in progress"
      if (['reading', 'watching', 'listening'].includes(parsed.status)) {
        const typeMap: Record<string, CurrentItem['type']> = {
          reading: 'reading',
          watching: 'watching',
          listening: 'listening',
        };

        currentItems.push({
          type: typeMap[parsed.status] || 'reading',
          mediaType: parsed.mediaType,
          title: parsed.title,
          cover: parsed.cover,
          date: parsed.date,
          url: item.link,
        });
      }

      // Limit to 5 items
      if (currentItems.length >= 5) break;
    }

    return currentItems;
  } catch (error) {
    console.error('Error fetching current items:', error);
    return [];
  }
}

/**
 * Generic RSS parser for other sources
 */
export async function fetchGenericRSS(url: string): Promise<FeedItem[]> {
  try {
    const feed = await fetchAndParseRSS(url);

    return feed.items.map((item) => ({
      id: item.guid || item.link || `rss-${Date.now()}-${Math.random()}`,
      type: 'article' as const,
      title: item.title || 'Untitled',
      content: item.contentSnippet || item.content || item.description || '',
      date: item.pubDate || item.isoDate ? new Date(item.pubDate || item.isoDate!) : new Date(),
      source: 'rss' as const,
      url: item.link,
    }));
  } catch (error) {
    console.error(`Error fetching RSS from ${url}:`, error);
    return [];
  }
}

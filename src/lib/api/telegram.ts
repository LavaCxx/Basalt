/**
 * Telegram Channel Feed Fetcher
 * Fetches messages from public Telegram channels via RSSHub
 * Uses fast-xml-parser for Cloudflare Workers compatibility
 */

import { XMLParser } from 'fast-xml-parser';
import type { FeedItem, MicroblogMetadata, MediaAttachment } from '../types';
import { getEnv } from './env';

/**
 * Check if Telegram is configured (RSSHub mode for public channels)
 */
export function isTelegramConfigured(): boolean {
  return !!getEnv('TELEGRAM_CHANNEL_USERNAME');
}

/**
 * Fetch and parse RSS feed using native fetch + fast-xml-parser
 */
async function fetchAndParseRSS(url: string): Promise<{ items: any[]; title?: string }> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'application/rss+xml, application/xml, text/xml, */*',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const xmlText = await response.text();

  // Parse XML with fast-xml-parser
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
  });

  const parsed = parser.parse(xmlText);
  const channel = parsed.rss?.channel || parsed.channel;
  const title = channel?.title;
  const rawItems = channel?.item || [];

  // Normalize items
  const items = (Array.isArray(rawItems) ? rawItems : [rawItems]).map((item: any) => ({
    title: item.title,
    link: item.link,
    pubDate: item.pubDate,
    isoDate: item.pubDate ? new Date(item.pubDate).toISOString() : undefined,
    content: item['content:encoded'] || item.description || item.content,
    description: item.description,
    contentSnippet: typeof item.description === 'string'
      ? item.description.replace(/<[^>]+>/g, '').trim()
      : '',
    guid: item.guid?.['#text'] || item.guid || item.link,
  }));

  return { items, title };
}

/**
 * Fetch messages via RSSHub (for public channels)
 */
async function fetchViaRSSHub(options?: {
  limit?: number;
}): Promise<FeedItem[]> {
  const TELEGRAM_CHANNEL_USERNAME = getEnv('TELEGRAM_CHANNEL_USERNAME');
  const RSSHUB_INSTANCE = getEnv('RSSHUB_INSTANCE') || 'https://rsshub.app';

  if (!TELEGRAM_CHANNEL_USERNAME) {
    return [];
  }

  try {
    const rssUrl = `${RSSHUB_INSTANCE}/telegram/channel/${TELEGRAM_CHANNEL_USERNAME}`;
    const feed = await fetchAndParseRSS(rssUrl);

    // Extract channel name from feed title (e.g., "环形废墟 - Telegram Channel")
    const feedTitle = feed.title || '';
    const channelName = feedTitle.replace(/ - Telegram Channel$/i, '').trim() || TELEGRAM_CHANNEL_USERNAME;

    const items: FeedItem[] = feed.items
      .slice(0, options?.limit || 20)
      .map((item) => {
        const content = item.contentSnippet || item.content || item.description || '';
        const date = item.pubDate || item.isoDate ? new Date(item.pubDate || item.isoDate!) : new Date();

        // Extract images from content
        const imgMatch = (item.content || '').match(/<img[^>]+src=["']([^"']+)["']/i);
        const image = imgMatch ? imgMatch[1] : undefined;

        // Extract attachments
        const attachments: MediaAttachment[] = [];
        if (image) {
          attachments.push({ type: 'image', url: image });
        }

        const metadata: MicroblogMetadata = {
          platform: 'telegram',
          channel: channelName,
          attachments: attachments.length > 0 ? attachments : undefined,
        };

        return {
          id: item.guid || `telegram-${Date.now()}-${Math.random()}`,
          type: 'microblog' as const,
          content: content.replace(/\n/g, '<br />'),
          date,
          source: 'telegram' as const,
          url: item.link,
          image,
          metadata,
        };
      });

    return items;
  } catch (error) {
    console.error('Error fetching Telegram messages via RSSHub:', error);
    return [];
  }
}

/**
 * Fetch Telegram channel feed
 */
export async function fetchTelegramFeed(options?: {
  limit?: number;
}): Promise<FeedItem[]> {
  if (!isTelegramConfigured()) {
    console.warn('Telegram is not configured. Set TELEGRAM_CHANNEL_USERNAME for public channels.');
    return [];
  }
  return fetchViaRSSHub(options);
}

/**
 * Get all Telegram messages for feed aggregation
 */
export async function getAllTelegramMessages(): Promise<FeedItem[]> {
  return fetchTelegramFeed({ limit: 50 });
}

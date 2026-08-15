/**
 * Telegram Channel Feed Fetcher
 * Fetches messages from public Telegram channels via RSSHub
 * (KV caching removed — data now lives in D1, populated by the sync worker)
 */

import type { FeedItem, MicroblogMetadata, MediaAttachment } from '../types';
import { getEnv } from './env';
import { fetchAndParseRSS } from './rss-parser';

/**
 * Check if Telegram is configured (RSSHub mode for public channels)
 */
export function isTelegramConfigured(): boolean {
  return !!getEnv('TELEGRAM_CHANNEL_USERNAME');
}

/**
 * Fetch messages via RSSHub (for public channels)
 */
export async function fetchViaRSSHub(options?: {
  limit?: number;
}): Promise<FeedItem[]> {
  const TELEGRAM_CHANNEL_USERNAME = getEnv('TELEGRAM_CHANNEL_USERNAME');
  const RSSHUB_INSTANCE = getEnv('RSSHUB_INSTANCE') || 'https://rsshub.app';

  if (!TELEGRAM_CHANNEL_USERNAME) {
    return [];
  }

  const rssUrl = `${RSSHUB_INSTANCE}/telegram/channel/${TELEGRAM_CHANNEL_USERNAME}`;
  const feed = await fetchAndParseRSS(rssUrl);

  // Extract channel name from feed title (e.g., "环形废墟 - Telegram Channel")
  const feedTitle = feed.title || '';
  const channelName = feedTitle.replace(/ - Telegram Channel$/i, '').trim() || TELEGRAM_CHANNEL_USERNAME;
  const currentImages = await fetchCurrentTelegramImages(TELEGRAM_CHANNEL_USERNAME).catch((error) => {
    console.warn('Failed to refresh Telegram image URLs:', error);
    return new Map<string, string[]>();
  });

  const items: FeedItem[] = feed.items
    .slice(0, options?.limit || 50)
    .map((item) => {
      const content = item.contentSnippet || item.content || item.description || '';
      const date = item.pubDate || item.isoDate ? new Date(item.pubDate || item.isoDate!) : new Date();

      // Extract images from content
      const images = currentImages.get(item.link) ||
        [...(item.content || '').matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map((match) => match[1]);
      const image = images[0];

      // Extract attachments
      const attachments: MediaAttachment[] = [];
      for (const imageUrl of images) {
        attachments.push({ type: 'image', url: imageUrl });
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
}

async function fetchCurrentTelegramImages(channelUsername: string): Promise<Map<string, string[]>> {
  const response = await fetch(`https://t.me/s/${channelUsername}`, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
    },
  });

  if (!response.ok) {
    throw new Error(`Telegram returned HTTP ${response.status}`);
  }

  const html = await response.text();
  const imagesByMessage = new Map<string, string[]>();
  const messagePattern = /<div[^>]+data-post="[^"]+"[\s\S]*?(?=<div[^>]+data-post=|<\/body>|$)/gi;
  const messages = html.match(messagePattern) || [];

  for (const message of messages) {
    const messageUrl = message.match(/data-post="([^"]+)"/i)?.[1];
    if (!messageUrl) continue;

    const images = [
      ...message.matchAll(/background-image:url\('([^']+)'\)/gi),
      ...message.matchAll(/<img[^>]+src="([^"]+)"/gi),
    ]
      .map((match) => match[1])
      .filter((url) => /^https:\/\/cdn\d+\.telesco\.pe\//i.test(url));

    if (images.length > 0) {
      imagesByMessage.set(`https://${messageUrl}`, [...new Set(images)]);
    }
  }

  return imagesByMessage;
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

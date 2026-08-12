/**
 * Telegram Channel Feed Fetcher
 * Fetches messages from public Telegram channels via RSSHub
 * Uses fast-xml-parser for Cloudflare Workers compatibility
 */

import type { FeedItem, MicroblogMetadata, MediaAttachment } from '../types';
import { getEnv } from './env';
import { fetchAndParseRSS } from './rss-parser';
import { withKVCache, isKVAvailable } from '../kv-cache';

/**
 * Check if Telegram is configured (RSSHub mode for public channels)
 */
export function isTelegramConfigured(): boolean {
  return !!getEnv('TELEGRAM_CHANNEL_USERNAME');
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
  if (isKVAvailable()) {
    return withKVCache<FeedItem[]>(
      'feed:telegram',
      () => fetchViaRSSHub(options),
      1800
    );
  }
  return fetchViaRSSHub(options);
}

/**
 * Get all Telegram messages for feed aggregation
 */
export async function getAllTelegramMessages(): Promise<FeedItem[]> {
  return fetchTelegramFeed({ limit: 50 });
}

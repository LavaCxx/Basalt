/**
 * Telegram Channel Feed Fetcher
 * Fetches messages from public Telegram channels via RSSHub
 * (KV caching removed — data now lives in D1, populated by the sync worker)
 */

import type { FeedItem, MicroblogMetadata, MediaAttachment, TelegramLinkPreview } from '../types';
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
  const telegramPages = await fetchCurrentTelegramMessages(TELEGRAM_CHANNEL_USERNAME).catch((error) => {
    console.warn('Failed to refresh Telegram image URLs:', error);
    return new Map<string, TelegramMessageDetails>();
  });

  const items: FeedItem[] = feed.items
    .slice(0, options?.limit || 50)
    .map((item) => {
      const date = item.pubDate || item.isoDate ? new Date(item.pubDate || item.isoDate!) : new Date();

      // RSS content contains both the user-authored text and Telegram's link-preview blockquote.
      const rssDescription = item.description || item.content || '';
      const descriptionWithoutPreview = rssDescription.replace(/<blockquote[\s\S]*?<\/blockquote>/gi, '');

      // Extract media images from content, excluding the link-preview blockquote.
      const imageMatches = [...descriptionWithoutPreview.matchAll(/<img[^>]+>/gi)];
      const rssImages = imageMatches.map((match) => {
        const tag = match[0];
        const url = tag.match(/src=["']([^"']+)["']/i)?.[1];
        const width = Number(tag.match(/\bwidth=["']([^"']+)["']/i)?.[1]);
        const height = Number(tag.match(/\bheight=["']([^"']+)["']/i)?.[1]);

        return {
          url,
          width: Number.isFinite(width) ? width : undefined,
          height: Number.isFinite(height) ? height : undefined,
        };
      })
        .filter((image) => !!image.url)
        .map((image) => ({ ...image, url: image.url! }));
      const currentMessage = telegramPages.get(item.link);
      const refreshedImages = currentMessage?.mediaImages;
      const images = refreshedImages?.map((url, index) => {
        const rssImage = rssImages.find((image) => image.url === url) || rssImages[index];
        return { ...rssImage, url };
      }) || rssImages;
      const image = images[0]
        ? telegramImageUrl(item.link, 0, 'media')
        : undefined;

      // Extract attachments
      const attachments: MediaAttachment[] = [];
      for (const [index, imageInfo] of images.entries()) {
        attachments.push({
          type: 'image',
          url: telegramImageUrl(item.link, index, 'media'),
          width: imageInfo.width,
          height: imageInfo.height,
        });
      }

      const linkPreview = stabilizePreviewImage(
        currentMessage?.linkPreview || extractRssLinkPreview(rssDescription),
        item.link
      );

      const metadata: MicroblogMetadata = {
        platform: 'telegram',
        channel: channelName,
        attachments: attachments.length > 0 ? attachments : undefined,
        linkPreview,
      };

      return {
        id: item.guid || `telegram-${Date.now()}-${Math.random()}`,
        type: 'microblog' as const,
        content: htmlToPlainText(descriptionWithoutPreview),
        date,
        source: 'telegram' as const,
        url: item.link,
        image,
        metadata,
      };
    });

  return items;
}

interface TelegramMessageDetails {
  mediaImages: string[];
  linkPreview?: TelegramLinkPreview;
}

function telegramImageUrl(messageUrl: string, index: number, variant: 'media' | 'preview'): string {
  return `/api/telegram-image?message=${encodeURIComponent(messageUrl)}&index=${index}&variant=${variant}`;
}

function stabilizePreviewImage(
  preview: TelegramLinkPreview | undefined,
  messageUrl: string
): TelegramLinkPreview | undefined {
  if (!preview?.image) return preview;
  return { ...preview, image: telegramImageUrl(messageUrl, 0, 'preview') };
}

async function fetchCurrentTelegramMessages(channelUsername: string): Promise<Map<string, TelegramMessageDetails>> {
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
  const detailsByMessage = new Map<string, TelegramMessageDetails>();
  const messagePattern = /<div[^>]*\bdata-post=["'][^"']+["'][^>]*>[\s\S]*?(?=<div[^>]*\bdata-post=["']|<\/body>|$)/gi;
  const messages = html.match(messagePattern) || [];

  for (const message of messages) {
    const messageUrl = message.match(/data-post=["']([^"']+)["']/i)?.[1];
    if (!messageUrl) continue;

    const mediaImages = [
      ...message.matchAll(
        /<[^>]+class=["'][^"']*tgme_widget_message_(?:photo|video)(?:_wrap)?[^"']*["'][^>]*>[\s\S]*?<\//gi
      ),
    ].flatMap((match) => extractTelescopeImageUrls(match[0]));

    detailsByMessage.set(`https://${messageUrl}`, {
      mediaImages: [...new Set(mediaImages)],
      linkPreview: extractTelegramLinkPreview(message),
    });
  }

  return detailsByMessage;
}

function extractTelescopeImageUrls(fragment: string): string[] {
  return [
    ...fragment.matchAll(/background-image:url\('([^']+)'\)/gi),
    ...fragment.matchAll(/<img[^>]+src=["']([^"']+)["']/gi),
  ]
    .map((match) => match[1])
    .filter((url) => /^https:\/\/cdn\d+\.telesco\.pe\/file\//i.test(url));
}

function extractTelegramLinkPreview(fragment: string): TelegramLinkPreview | undefined {
  const previewPattern = /<a[^>]+class=["'][^"']*tgme_widget_message_link_preview[^"']*["'][^>]*>[\s\S]*?<\/a>/i;
  const preview = fragment.match(previewPattern)?.[0];
  const url = preview?.match(/^<a[^>]+href=["']([^"']+)["']/i)?.[1];
  if (!preview || !url) return undefined;

  const siteName = extractClassText(preview, 'link_preview_site_name');
  const title = extractClassText(preview, 'link_preview_title');
  const description = extractClassText(preview, 'link_preview_description');
  const image = extractTelescopeImageUrls(preview)[0];

  return {
    url,
    ...(siteName ? { siteName } : {}),
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(image ? { image } : {}),
  };
}

function extractRssLinkPreview(html: string): TelegramLinkPreview | undefined {
  const blockquote = html.match(/<blockquote[\s\S]*?<\/blockquote>/i)?.[0];
  if (!blockquote) return undefined;

  const url = blockquote.match(/<a[^>]+href=["']([^"']+)["']/i)?.[1];
  if (!url) return undefined;

  const boldParts = [...blockquote.matchAll(/<b[^>]*>([\s\S]*?)<\/b>/gi)].map((match) => match[1]);
  const siteName = htmlToPlainText(boldParts[0] || '');
  const linkedTitle = htmlToPlainText(boldParts.find((part) => part.includes('<a')) || '');
  const paragraphs = [...blockquote.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((match) => match[1]);
  const description = htmlToPlainText(
    paragraphs.find((part) => !part.includes('<a') && htmlToPlainText(part) !== siteName) || ''
  );
  const image = extractTelescopeImageUrls(blockquote)[0];

  return {
    url,
    ...(siteName && siteName !== linkedTitle ? { siteName } : {}),
    ...(linkedTitle ? { title: linkedTitle } : {}),
    ...(description ? { description } : {}),
    ...(image ? { image } : {}),
  };
}

function extractClassText(fragment: string, className: string): string | undefined {
  const text = fragment.match(
    new RegExp(`<[^>]+class=["'][^"']*${className}[^"']*["'][^>]*>([\\s\\S]*?)<\\/`, 'i')
  )?.[1];
  const decoded = htmlToPlainText(text || '');
  return decoded || undefined;
}

function htmlToPlainText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
  ).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, ' ');
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

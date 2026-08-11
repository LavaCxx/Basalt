/**
 * Unified data fetching module
 * Combines content from all sources (Notion, Telegram, Douban, etc.)
 */

import type { FeedItem, ArchiveGroup, CurrentItem } from '../types';
import { fetchArticles, getAllArticles, fetchPhotos, getAllPhotos, fetchArticle } from './notion';
import { fetchDoubanFeed, getCurrentItems as getDoubanCurrentItems } from './rss';
import { fetchTelegramFeed, isTelegramConfigured } from './telegram';
import { mockFeedItems, mockArchiveGroups, getArchiveGroups, mockCurrentItems } from '../mock-data';

// Re-export env utilities
export { getEnv, setRuntimeEnv } from './env';

// Import getEnv for internal use
import { getEnv, setRuntimeEnv as baseSetRuntimeEnv } from './env';
import { setRuntimeKVEnv } from '../kv-cache';

/**
 * Set runtime env for Cloudflare Workers
 * (KV cache is auto-cleared on TTL expiry)
 */
export function setRuntimeEnvAndClearCache(env: Record<string, any>) {
  baseSetRuntimeEnv(env);
  setRuntimeKVEnv(env); // Also set KV binding
}

// Check if should use real API - evaluated at call time for API routes
export function shouldUseRealAPI() {
  return !!(getEnv('NOTION_API_KEY') && getEnv('NOTION_ARTICLES_DATABASE_ID'));
}

export function shouldUseDouban() {
  return !!getEnv('DOUBAN_USER_RSS');
}

export function shouldUseTelegram() {
  return isTelegramConfigured();
}

// Debug info for getFeedItems
let feedItemsDebug: Record<string, any> = {};

export function getFeedItemsDebug(): Record<string, any> {
  return { ...feedItemsDebug };
}

/**
 * Get feed items for home page
 */
export async function getFeedItems(options?: {
  pageSize?: number;
  useMock?: boolean;
}): Promise<FeedItem[]> {
  const USE_REAL_API = shouldUseRealAPI();
  const USE_DOUBAN_RSS = shouldUseDouban();
  const USE_TELEGRAM = shouldUseTelegram();

  // Force mock data if explicitly requested, or if no APIs are configured (dev only)
  if (options?.useMock || (import.meta.env.DEV && !USE_REAL_API && !USE_DOUBAN_RSS && !USE_TELEGRAM)) {
    return mockFeedItems;
  }

  // Production with no sources configured: return empty
  if (!USE_REAL_API && !USE_DOUBAN_RSS && !USE_TELEGRAM) {
    return [];
  }

  // Each source is fetched independently — one source failing must not
  // discard results from the others. Use allSettled so a broken RSS feed
  // or a Notion hiccup only zeroes out its own contribution.
  const tasks: Promise<FeedItem[]>[] = [];
  const labels: string[] = [];

  if (USE_REAL_API) {
    // Notion articles and photos as one settled unit
    tasks.push(
      Promise.all([getAllArticles(), getAllPhotos()])
        .then(([a, p]) => [...a, ...p])
    );
    labels.push('notion');
  }
  if (USE_DOUBAN_RSS) {
    tasks.push(fetchDoubanFeed());
    labels.push('douban');
  }
  if (USE_TELEGRAM) {
    tasks.push(fetchTelegramFeed({ limit: 30 }));
    labels.push('telegram');
  }

  const settled = await Promise.allSettled(tasks);
  const results: FeedItem[][] = [];
  settled.forEach((res, i) => {
    if (res.status === 'fulfilled') {
      results.push(res.value);
    } else {
      console.error(`[feed] source "${labels[i]}" failed:`, res.reason);
    }
  });

  const allItems = results.flat();

    // Ensure all dates are Date objects, then sort by date descending
    allItems.forEach(item => {
      if (!(item.date instanceof Date)) {
        item.date = new Date(item.date as any);
      }
    });
    allItems.sort((a, b) => {
      const aTime = a.date instanceof Date ? a.date.getTime() : 0;
      const bTime = b.date instanceof Date ? b.date.getTime() : 0;
      return bTime - aTime;
    });

  return allItems;
}

/**
 * Get "currently consuming" items for sidebar
 */
export async function getCurrentItems(): Promise<CurrentItem[]> {
  if (!shouldUseDouban()) {
    return import.meta.env.DEV ? mockCurrentItems : [];
  }

  try {
    const items = await getDoubanCurrentItems();
    if (items.length > 0) {
      return items;
    }
    // Dev: fallback to mock; Production: return empty
    return import.meta.env.DEV ? mockCurrentItems : [];
  } catch (error) {
    console.error('Error fetching current items:', error);
    return import.meta.env.DEV ? mockCurrentItems : [];
  }
}

/**
 * Get articles for archives page
 */
export async function getArchiveItems(): Promise<ArchiveGroup[]> {
  if (!shouldUseRealAPI()) {
    return import.meta.env.DEV ? mockArchiveGroups : [];
  }

  try {
    const articles = await getAllArticles();
    const result = getArchiveGroups(articles);
    return result;
  } catch (error) {
    console.error('Error fetching archive items:', error);
    return import.meta.env.DEV ? mockArchiveGroups : [];
  }
}

/**
 * Get featured articles
 */
export async function getFeaturedArticles(): Promise<FeedItem[]> {
  const items = await getFeedItems();
  return items.filter(
    (item) => item.type === 'article' && (item.metadata as any)?.featured
  );
}

/**
 * Get recent items
 */
export async function getRecentFeedItems(count: number = 10): Promise<FeedItem[]> {
  const items = await getFeedItems();
  return items.slice(0, count);
}

/**
 * Get a single article by slug or ID (with full content)
 */
export async function getArticleBySlug(slug: string): Promise<FeedItem | null> {
  if (!shouldUseRealAPI()) {
    if (import.meta.env.DEV) {
      return (
      mockFeedItems.find(
        (item) => item.type === 'article' && item.url?.endsWith(slug)
      ) || null
    );
    }
    return null;
  }

  try {
    // First, find the article to get its ID
    const articles = await getAllArticles();
    const found = articles.find((a) => {
      const articleSlug = a.url?.split('/').pop();
      return articleSlug === slug || a.id === slug;
    });

    if (!found) return null;

    // Fetch full content using the article ID
    const fullArticle = await fetchArticle(found.id);
    return fullArticle;
  } catch (error) {
    console.error(`Error fetching article ${slug}:`, error);
    return null;
  }
}

/**
 * Get all article slugs for static generation
 */
export async function getAllArticleSlugs(): Promise<string[]> {
  if (!shouldUseRealAPI()) {
    if (import.meta.env.DEV) {
      return mockFeedItems
      .filter((item) => item.type === 'article')
      .map((item) => item.url?.split('/').pop() || item.id);
    }
    return [];
  }

  try {
    const articles = await getAllArticles();
    return articles.map((a) => a.url?.split('/').pop() || a.id);
  } catch (error) {
    console.error('Error fetching article slugs:', error);
    return import.meta.env.DEV ? mockFeedItems
      .filter((item) => item.type === 'article')
      .map((item) => item.url?.split('/').pop() || item.id) : [];
  }
}

/**
 * Get photos grouped by year
 */
export async function getPhotosByYear(): Promise<Record<number, FeedItem[]>> {
  if (!shouldUseRealAPI()) {
    // Return mock photos from memories page
    return {};
  }

  try {
    const photos = await getAllPhotos();

    // Group by year
    const grouped: Record<number, FeedItem[]> = {};
    for (const photo of photos) {
      const year = photo.date.getFullYear();
      if (!grouped[year]) {
        grouped[year] = [];
      }
      grouped[year].push(photo);
    }

    // Sort years descending
    const sortedYears = Object.keys(grouped)
      .map(Number)
      .sort((a, b) => b - a);

    const result: Record<number, FeedItem[]> = {};
    for (const year of sortedYears) {
      result[year] = grouped[year];
    }

    return result;
  } catch (error) {
    console.error('Error fetching photos:', error);
    return {};
  }
}

// Re-export types
export type { FeedItem, ArchiveGroup, CurrentItem } from '../types';

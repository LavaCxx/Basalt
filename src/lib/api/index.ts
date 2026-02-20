/**
 * Unified data fetching module
 * Combines content from all sources (Notion, Telegram, Douban, etc.)
 */

import type { FeedItem, ArchiveGroup, CurrentItem } from '../types';
import { fetchArticles, getAllArticles, fetchPhotos, getAllPhotos, fetchArticle } from './notion';
import { fetchDoubanFeed, getCurrentItems as getDoubanCurrentItems } from './rss';
import { fetchTelegramFeed, isTelegramConfigured } from './telegram';
import { mockFeedItems, mockArchiveGroups, getArchiveGroups, mockCurrentItems } from '../mock-data';

/**
 * Simple in-memory cache with TTL
 */
function createCache<T>(ttlMs: number = 5 * 60 * 1000) { // Default 5 minutes
  let cachedData: T | null = null;
  let cachedAt: number = 0;

  return {
    get(): T | null {
      if (cachedData && Date.now() - cachedAt < ttlMs) {
        return cachedData;
      }
      return null;
    },
    set(data: T) {
      cachedData = data;
      cachedAt = Date.now();
    },
    clear() {
      cachedData = null;
      cachedAt = 0;
    }
  };
}

// Create caches for each data type
const feedItemsCache = createCache<FeedItem[]>();
const archiveItemsCache = createCache<ArchiveGroup[]>();
const currentItemsCache = createCache<CurrentItem[]>();

/**
 * Whether to use real APIs or mock data
 * Try both import.meta.env (Astro/Vite) and process.env (Node)
 */
const getEnv = (key: string): string | undefined => {
  return (import.meta as any).env?.[key] || process.env[key];
};

// Check if should use real API - evaluated at call time for API routes
function shouldUseRealAPI() {
  return !!(getEnv('NOTION_API_KEY') && getEnv('NOTION_ARTICLES_DATABASE_ID'));
}

function shouldUseDouban() {
  return !!getEnv('DOUBAN_USER_RSS');
}

function shouldUseTelegram() {
  return isTelegramConfigured();
}

/**
 * Get feed items for home page
 */
export async function getFeedItems(options?: {
  pageSize?: number;
  useMock?: boolean;
}): Promise<FeedItem[]> {
  // Check cache first
  const cached = feedItemsCache.get();
  if (cached) {
    return cached;
  }

  const USE_REAL_API = shouldUseRealAPI();
  const USE_DOUBAN_RSS = shouldUseDouban();
  const USE_TELEGRAM = shouldUseTelegram();

  // Force mock data if requested or if no APIs are configured
  if (options?.useMock || (!USE_REAL_API && !USE_DOUBAN_RSS && !USE_TELEGRAM)) {
    return mockFeedItems;
  }

  try {
    const promises: Promise<FeedItem[]>[] = [];

    // Fetch from Notion if configured
    if (USE_REAL_API) {
      promises.push(
        Promise.all([getAllArticles(), getAllPhotos()]).then(([articles, photos]) => [
          ...articles,
          ...photos,
        ])
      );
    }

    // Fetch from Douban if configured
    if (USE_DOUBAN_RSS) {
      promises.push(fetchDoubanFeed());
    }

    // Fetch from Telegram if configured
    if (USE_TELEGRAM) {
      promises.push(fetchTelegramFeed({ limit: 30 }));
    }

    const results = await Promise.all(promises);
    const allItems = results.flat();

    // Sort by date descending
    allItems.sort((a, b) => b.date.getTime() - a.date.getTime());

    // Cache the results
    feedItemsCache.set(allItems);

    return allItems;
  } catch (error) {
    console.error('Error fetching feed items:', error);
    // Fallback to mock data on error
    return mockFeedItems;
  }
}

/**
 * Get "currently consuming" items for sidebar
 */
export async function getCurrentItems(): Promise<CurrentItem[]> {
  // Check cache first
  const cached = currentItemsCache.get();
  if (cached) {
    return cached;
  }

  if (!shouldUseDouban()) {
    return mockCurrentItems;
  }

  try {
    const items = await getDoubanCurrentItems();
    if (items.length > 0) {
      currentItemsCache.set(items);
      return items;
    }
    // Fallback to mock if no items found
    return mockCurrentItems;
  } catch (error) {
    console.error('Error fetching current items:', error);
    return mockCurrentItems;
  }
}

/**
 * Get articles for archives page
 */
export async function getArchiveItems(): Promise<ArchiveGroup[]> {
  // Check cache first
  const cached = archiveItemsCache.get();
  if (cached) {
    return cached;
  }

  if (!shouldUseRealAPI()) {
    return mockArchiveGroups;
  }

  try {
    const articles = await getAllArticles();
    const result = getArchiveGroups(articles);
    archiveItemsCache.set(result);
    return result;
  } catch (error) {
    console.error('Error fetching archive items:', error);
    return mockArchiveGroups;
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
    return (
      mockFeedItems.find(
        (item) => item.type === 'article' && item.url?.endsWith(slug)
      ) || null
    );
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
    return mockFeedItems
      .filter((item) => item.type === 'article')
      .map((item) => item.url?.split('/').pop() || item.id);
  }

  try {
    const articles = await getAllArticles();
    return articles.map((a) => a.url?.split('/').pop() || a.id);
  } catch (error) {
    console.error('Error fetching article slugs:', error);
    return [];
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

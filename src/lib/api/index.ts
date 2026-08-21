/**
 * Unified data access module — D1 backed.
 *
 * The blog reads ALL content from D1 (populated by the sync worker).
 * In development mode, if D1 is not available, we fall back to mock data.
 */

import type { FeedItem, ArchiveGroup, CurrentItem, FeedPage, FeedStats } from '../types';
import { mockFeedItems, mockArchiveGroups, mockCurrentItems, mockCurrentGames } from '../mock-data';
import { getDemoSteamSnapshot } from '../steam';
import type { ManualGame, SteamSnapshot } from '../types';

import {
  setRuntimeDB,
  isDBAvailable,
  queryItems,
  queryFeedPage,
  queryFeedStats,
  decodeFeedCursor,
  queryArticleBySlug,
  queryAllArticleSlugs,
  queryArchiveGroups,
  queryPhotosByYear,
  queryCurrentGames,
  queryCurrentItems,
  querySteamSnapshot,
} from '../db';

// Re-export env utilities (still needed for Notion client used in sync worker)
export { getEnv, setRuntimeEnv } from './env';
export { setRuntimeDB, isDBAvailable };

/**
 * Initialize D1 binding from Cloudflare runtime env.
 * Called from pages and API routes before any data access.
 */
export function initRuntime(env: Record<string, any>): void {
  setRuntimeDB(env);
}

/**
 * Get unified feed items from D1.
 */
export async function getFeedItems(): Promise<FeedItem[]> {
  if (!isDBAvailable()) {
    return import.meta.env.DEV ? mockFeedItems : [];
  }

  try {
    return await queryItems();
  } catch (error) {
    console.error('Error fetching feed items from D1:', error);
    return import.meta.env.DEV ? mockFeedItems : [];
  }
}

export async function getFeedPage(options: { limit: number; cursor?: string }): Promise<FeedPage> {
  const cursor = options.cursor ? decodeFeedCursor(options.cursor) : undefined;
  if (options.cursor && !cursor) throw new Error('Invalid feed cursor');

  if (!isDBAvailable()) {
    const items = import.meta.env.DEV ? mockFeedItems.slice(0, options.limit) : [];
    return { items, nextCursor: null };
  }

  try {
    return await queryFeedPage({ limit: options.limit, cursor: cursor ?? undefined });
  } catch (error) {
    console.error('Error fetching feed page from D1:', error);
    const items = import.meta.env.DEV ? mockFeedItems.slice(0, options.limit) : [];
    return { items, nextCursor: null };
  }
}

export async function getFeedStats(): Promise<FeedStats> {
  if (!isDBAvailable()) return countFeedItems(import.meta.env.DEV ? mockFeedItems : []);
  try {
    return await queryFeedStats();
  } catch (error) {
    console.error('Error fetching feed stats from D1:', error);
    return countFeedItems(import.meta.env.DEV ? mockFeedItems : []);
  }
}

function countFeedItems(items: FeedItem[]): FeedStats {
  return {
    articles: items.filter((item) => item.type === 'article').length,
    photos: items.filter((item) => item.type === 'photo').length,
    microblogs: items.filter((item) => item.type === 'microblog').length,
    media: items.filter((item) => item.type === 'media').length,
  };
}

/**
 * Get articles only.
 */
export async function getArticles(): Promise<FeedItem[]> {
  if (!isDBAvailable()) {
    return import.meta.env.DEV ? mockFeedItems.filter((i) => i.type === 'article') : [];
  }

  try {
    return await queryItems({ types: ['article'] });
  } catch (error) {
    console.error('Error fetching articles from D1:', error);
    return import.meta.env.DEV ? mockFeedItems.filter((i) => i.type === 'article') : [];
  }
}

/**
 * Get a single article by slug or ID (with full HTML body).
 */
export async function getArticleBySlug(slug: string): Promise<FeedItem | null> {
  if (!isDBAvailable()) {
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
    return await queryArticleBySlug(slug);
  } catch (error) {
    console.error(`Error fetching article ${slug}:`, error);
    if (!import.meta.env.DEV) return null;
    return (
      mockFeedItems.find(
        (item) => item.type === 'article' && item.url?.endsWith(slug)
      ) || null
    );
  }
}

/**
 * Get all article slugs for static generation.
 */
export async function getAllArticleSlugs(): Promise<string[]> {
  if (!isDBAvailable()) {
    if (import.meta.env.DEV) {
      return mockFeedItems
        .filter((item) => item.type === 'article')
        .map((item) => item.url?.split('/').pop() || item.id);
    }
    return [];
  }

  try {
    return await queryAllArticleSlugs();
  } catch (error) {
    console.error('Error fetching article slugs:', error);
    return [];
  }
}

/**
 * Get archive items grouped by year.
 */
export async function getArchiveItems(): Promise<ArchiveGroup[]> {
  if (!isDBAvailable()) {
    return import.meta.env.DEV ? mockArchiveGroups : [];
  }

  try {
    return await queryArchiveGroups();
  } catch (error) {
    console.error('Error fetching archive items:', error);
    return import.meta.env.DEV ? mockArchiveGroups : [];
  }
}

/**
 * Get photos grouped by year.
 */
export async function getPhotosByYear(): Promise<Record<number, FeedItem[]>> {
  if (!isDBAvailable()) {
    return {};
  }

  try {
    return await queryPhotosByYear();
  } catch (error) {
    console.error('Error fetching photos:', error);
    return {};
  }
}

/**
 * Get "currently consuming" items from D1.
 */
export async function getCurrentItems(): Promise<CurrentItem[]> {
  if (!isDBAvailable()) {
    return import.meta.env.DEV ? mockCurrentItems : [];
  }

  try {
    const items = await queryCurrentItems();
    if (items.length > 0) return items;
    return import.meta.env.DEV ? mockCurrentItems : [];
  } catch (error) {
    console.error('Error fetching current items:', error);
    return import.meta.env.DEV ? mockCurrentItems : [];
  }
}

export async function getSteamSnapshot(): Promise<SteamSnapshot> {
  if (!isDBAvailable()) {
    return import.meta.env.DEV ? getDemoSteamSnapshot() : { games: [], status: { online: false } };
  }

  try {
    return await querySteamSnapshot();
  } catch (error) {
    console.error('Error fetching Steam snapshot from D1:', error);
    return import.meta.env.DEV
      ? getDemoSteamSnapshot()
      : { games: [], status: { online: false } };
  }
}

export async function getCurrentGames(): Promise<ManualGame[]> {
  if (!isDBAvailable()) {
    return import.meta.env.DEV ? mockCurrentGames : [];
  }

  try {
    const games = await queryCurrentGames();
    return import.meta.env.DEV && games.length === 0 ? mockCurrentGames : games;
  } catch (error) {
    console.error('Error fetching current games:', error);
    return import.meta.env.DEV ? mockCurrentGames : [];
  }
}

/**
 * Get featured articles.
 */
export async function getFeaturedArticles(): Promise<FeedItem[]> {
  const items = await getFeedItems();
  return items.filter(
    (item) => item.type === 'article' && (item.metadata as any)?.featured
  );
}

/**
 * Get recent feed items.
 */
export async function getRecentFeedItems(count: number = 10): Promise<FeedItem[]> {
  const items = await getFeedItems();
  return items.slice(0, count);
}

// Re-export types
export type { FeedItem, ArchiveGroup, CurrentItem, ManualGame } from '../types';

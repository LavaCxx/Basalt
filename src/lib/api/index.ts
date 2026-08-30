/**
 * Unified data access module — D1 backed.
 *
 * The blog reads ALL content from D1 (populated by the sync worker).
 * Development and production both read from D1. Missing bindings and query
 * failures return empty results rather than substituting mock content.
 */

import type { ArticleFeedItem, FeedItem, ArchiveGroup, CurrentItem, FeedPage, FeedStats, Friend } from '../types';
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
  queryPageByPath,
  queryFriends,
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
    return [];
  }

  try {
    return await queryItems();
  } catch (error) {
    console.error('Error fetching feed items from D1:', error);
    return [];
  }
}

export async function getFeedPage(options: { limit: number; cursor?: string }): Promise<FeedPage> {
  const cursor = options.cursor ? decodeFeedCursor(options.cursor) : undefined;
  if (options.cursor && !cursor) throw new Error('Invalid feed cursor');

  if (!isDBAvailable()) {
    return { items: [], nextCursor: null };
  }

  try {
    return await queryFeedPage({ limit: options.limit, cursor: cursor ?? undefined });
  } catch (error) {
    console.error('Error fetching feed page from D1:', error);
    return { items: [], nextCursor: null };
  }
}

export async function getFeedStats(): Promise<FeedStats> {
  if (!isDBAvailable()) return countFeedItems([]);
  try {
    return await queryFeedStats();
  } catch (error) {
    console.error('Error fetching feed stats from D1:', error);
    return countFeedItems([]);
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
    return [];
  }

  try {
    return await queryItems({ types: ['article'] });
  } catch (error) {
    console.error('Error fetching articles from D1:', error);
    return [];
  }
}

/** Get the most recently published article for the homepage reading entry. */
export async function getLatestArticle(): Promise<ArticleFeedItem | null> {
  if (!isDBAvailable()) {
    return null;
  }

  try {
    const [article] = await queryItems({ types: ['article'], limit: 1 });
    return article?.type === 'article' ? article : null;
  } catch (error) {
    console.error('Error fetching latest article:', error);
    return null;
  }
}

/**
 * Get a single article by slug or ID (with full HTML body).
 */
export async function getArticleBySlug(slug: string): Promise<FeedItem | null> {
  if (!isDBAvailable()) {
    return null;
  }

  try {
    return await queryArticleBySlug(slug);
  } catch (error) {
    console.error(`Error fetching article ${slug}:`, error);
    return null;
  }
}

export async function getPageByPath(path: string): Promise<FeedItem | null> {
  if (!isDBAvailable()) return null;
  try {
    return await queryPageByPath(path);
  } catch (error) {
    console.error(`Error fetching page ${path}:`, error);
    return null;
  }
}

export async function getFriends(): Promise<Friend[]> {
  if (!isDBAvailable()) return [];
  try {
    return await queryFriends();
  } catch (error) {
    console.error('Error fetching friends:', error);
    return [];
  }
}

/**
 * Get all article slugs for static generation.
 */
export async function getAllArticleSlugs(): Promise<string[]> {
  if (!isDBAvailable()) {
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
    return [];
  }

  try {
    return await queryArchiveGroups();
  } catch (error) {
    console.error('Error fetching archive items:', error);
    return [];
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
    return [];
  }

  try {
    const items = await queryCurrentItems();
    return items;
  } catch (error) {
    console.error('Error fetching current items:', error);
    return [];
  }
}

export async function getSteamSnapshot(): Promise<SteamSnapshot> {
  if (!isDBAvailable()) {
    return { games: [], status: { online: false } };
  }

  try {
    return await querySteamSnapshot();
  } catch (error) {
    console.error('Error fetching Steam snapshot from D1:', error);
    return { games: [], status: { online: false } };
  }
}

export async function getCurrentGames(): Promise<ManualGame[]> {
  if (!isDBAvailable()) {
    return [];
  }

  try {
    return await queryCurrentGames();
  } catch (error) {
    console.error('Error fetching current games:', error);
    return [];
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

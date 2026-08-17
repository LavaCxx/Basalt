/**
 * Unified data access module — D1 backed.
 *
 * The blog reads ALL content from D1 (populated by the sync worker).
 * In development mode, if D1 is not available, we fall back to mock data.
 */

import type { FeedItem, ArchiveGroup, CurrentItem } from '../types';
import { mockFeedItems, mockArchiveGroups, mockCurrentItems } from '../mock-data';
import { getDemoSteamSnapshot } from '../steam';
import type { SteamSnapshot } from '../types';

import {
  setRuntimeDB,
  isDBAvailable,
  queryItems,
  queryArticleBySlug,
  queryAllArticleSlugs,
  queryArchiveGroups,
  queryPhotosByYear,
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
export type { FeedItem, ArchiveGroup, CurrentItem } from '../types';

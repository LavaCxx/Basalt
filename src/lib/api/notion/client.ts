/**
 * Notion client initialization and env helpers
 */

import { Client } from '@notionhq/client';
import { getEnv } from '../env';
import { withKVCache, isKVAvailable } from '../../kv-cache';

// Cache TTL: 1 hour
export const CACHE_TTL_SECONDS = 3600;

// Cache keys
export const CACHE_KEYS = {
  ARTICLES: 'notion:articles:all',
  PHOTOS: 'notion:photos:all',
  ARTICLE_PREFIX: 'notion:article:',
};

// Lazy-initialized Notion client
let _notion: InstanceType<typeof Client> | null = null;

export function getNotionClient(): InstanceType<typeof Client> {
  if (!_notion) {
    const apiKey = getEnv('NOTION_API_KEY');
    if (!apiKey) {
      throw new Error('NOTION_API_KEY is not set');
    }
    _notion = new Client({ auth: apiKey });
  }
  return _notion;
}

export function getArticlesDatabaseId() {
  return getEnv('NOTION_ARTICLES_DATABASE_ID');
}

export function getPhotosDatabaseId() {
  return getEnv('NOTION_PHOTOS_DATABASE_ID');
}

/** Re-export KV cache utilities for convenience */
export { withKVCache, isKVAvailable };

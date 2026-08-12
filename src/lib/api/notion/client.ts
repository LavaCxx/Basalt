/**
 * Notion client initialization and env helpers
 * (KV caching removed — data now lives in D1, populated by the sync worker)
 */

import { Client } from '@notionhq/client';
import { getEnv } from '../env';

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

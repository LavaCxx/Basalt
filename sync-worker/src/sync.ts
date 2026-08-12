/**
 * Source-specific sync functions.
 * Each function pulls data from a third-party source and writes it to D1.
 */

import { setRuntimeEnv } from '../../src/lib/api/env';
import { fetchArticles, fetchArticle } from '../../src/lib/api/notion/articles';
import { fetchPhotos } from '../../src/lib/api/notion/photos';
import { getAllTelegramMessages } from '../../src/lib/api/telegram';
import { fetchDoubanFeed } from '../../src/lib/api/rss';
import { calculateReadingTime } from '../../src/lib/api/notion/blocks-to-html';
import type { FeedItem } from '../../src/lib/types';

import { upsertItem, upsertArticleBody, getSyncState, updateSyncState, deleteStaleItems } from './db';
import { ensureBookmarksEnriched, createBookmarkResolver } from './link-enricher';
import type { D1Database } from './db';

/**
 * Sync Notion articles with full content + bookmark enrichment.
 */
export async function syncNotionArticles(db: D1Database, env: Record<string, string>): Promise<void> {
  setRuntimeEnv(env);

  // First, sync the article list (lightweight metadata)
  let cursor: string | null = (await getSyncState(db, 'notion:articles'))?.cursor ?? null;
  const allArticleItems: FeedItem[] = [];

  // Fetch all articles (paginate through the Notion database)
  let hasMore = true;
  while (hasMore) {
    const { articles, hasMore: more, nextCursor } = await fetchArticles({
      pageSize: 100,
      startCursor: cursor,
    });
    allArticleItems.push(...articles);
    hasMore = more;
    cursor = nextCursor;
  }

  // Upsert article metadata into items table
  for (const article of allArticleItems) {
    await upsertItem(db, article);
  }

  // For each article, fetch full content with bookmark enrichment, then store HTML
  const resolveBookmarkMeta = createBookmarkResolver(db);

  for (const article of allArticleItems) {
    // 1. Enrich any bookmark URLs that aren't in D1 yet
    await ensureBookmarksEnriched(db, article.id);

    // 2. Fetch full article HTML (using the resolver to embed enriched bookmark data)
    const fullArticle = await fetchArticle(article.id, { resolveBookmarkMeta });
    if (fullArticle && fullArticle.content) {
      const readingTime = calculateReadingTime(fullArticle.content);
      await upsertArticleBody(db, article.id, fullArticle.content, readingTime);

      // Also update the item's readingTime in metadata
      const metadata = (article.metadata as any) || {};
      metadata.readingTime = readingTime;
      await upsertItem(db, { ...article, metadata });
    }
  }

  // Reset cursor to null after full sync (articles don't use incremental cursor long-term)
  await updateSyncState(db, 'notion:articles', null);
}

/**
 * Sync Notion photos.
 */
export async function syncNotionPhotos(db: D1Database, env: Record<string, string>): Promise<void> {
  setRuntimeEnv(env);

  const allPhotos: FeedItem[] = [];
  let hasMore = true;
  let cursor: string | null = null;

  while (hasMore) {
    const { photos, hasMore: more, nextCursor } = await fetchPhotos({
      pageSize: 100,
      startCursor: cursor,
    });
    allPhotos.push(...photos);
    hasMore = more;
    cursor = nextCursor;
  }

  for (const photo of allPhotos) {
    await upsertItem(db, photo);
  }

  await updateSyncState(db, 'notion:photos', null);
}

/**
 * Sync Telegram microblog posts via RSSHub.
 */
export async function syncTelegram(db: D1Database, env: Record<string, string>): Promise<void> {
  setRuntimeEnv(env);

  const messages = await getAllTelegramMessages();
  if (messages.length === 0) return;

  for (const msg of messages) {
    await upsertItem(db, msg);
  }

  // Clean up items that disappeared from the feed (RSS only returns recent N items)
  await deleteStaleItems(db, 'telegram', messages.map((m) => m.id));
  await updateSyncState(db, 'telegram', null);
}

/**
 * Sync Douban media feed.
 */
export async function syncDouban(db: D1Database, env: Record<string, string>): Promise<void> {
  setRuntimeEnv(env);

  const items = await fetchDoubanFeed();
  if (items.length === 0) return;

  for (const item of items) {
    await upsertItem(db, item);
  }

  await deleteStaleItems(db, 'douban', items.map((i) => i.id));
  await updateSyncState(db, 'douban', null);
}

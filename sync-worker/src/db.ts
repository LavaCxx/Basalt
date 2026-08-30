/**
 * D1 database helpers for the sync worker.
 * Handles upserting items, article bodies, and sync state.
 */

import type { FeedItem } from '../../src/lib/types';
import type { NotionFriend } from '../../src/lib/api/notion/friends';
import type { LatestFriendPost } from './friend-rss';

interface D1Database {
  prepare: (sql: string) => {
    bind: (...values: any[]) => {
      first: () => Promise<any>;
      all: () => Promise<{ results: any[] }>;
      run: () => Promise<any>;
    };
    first: () => Promise<any>;
    all: () => Promise<{ results: any[] }>;
    run: () => Promise<any>;
  };
}

export type { D1Database };

/**
 * Upsert a single feed item into the items table.
 */
export async function upsertItem(db: D1Database, item: FeedItem): Promise<void> {
  await db
    .prepare(
      `INSERT INTO items (id, type, source, title, content, url, image, date, source_updated_at, metadata_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         type = excluded.type,
         source = excluded.source,
         title = excluded.title,
         content = excluded.content,
         url = excluded.url,
         image = excluded.image,
         date = excluded.date,
         source_updated_at = excluded.source_updated_at,
         metadata_json = excluded.metadata_json,
         updated_at = datetime('now')`
    )
    .bind(
      item.id,
      item.type,
      item.source,
      item.title || null,
      item.content,
      item.url || null,
      item.image || null,
      item.date instanceof Date ? item.date.toISOString() : new Date(item.date).toISOString(),
      item.updatedDate
        ? (item.updatedDate instanceof Date ? item.updatedDate : new Date(item.updatedDate)).toISOString()
        : null,
      item.metadata ? JSON.stringify(item.metadata) : null
    )
    .run();
}

/**
 * Upsert article body (full HTML + reading time).
 */
export async function upsertArticleBody(
  db: D1Database,
  itemId: string,
  html: string,
  readingTime: number
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO article_bodies (item_id, html, reading_time)
       VALUES (?, ?, ?)
       ON CONFLICT(item_id) DO UPDATE SET
         html = excluded.html,
         reading_time = excluded.reading_time`
    )
    .bind(itemId, html, readingTime)
    .run();
}

/**
 * Get sync state for a source.
 */
export async function getSyncState(db: D1Database, source: string): Promise<{ cursor: string | null } | null> {
  const row = await db
    .prepare('SELECT cursor FROM sync_state WHERE source = ?')
    .bind(source)
    .first();
  if (!row) return null;
  return { cursor: (row as any).cursor ?? null };
}

/**
 * Update sync state (cursor + last_synced_at).
 */
export async function updateSyncState(db: D1Database, source: string, cursor: string | null): Promise<void> {
  await db
    .prepare(
      `INSERT INTO sync_state (source, cursor, last_synced_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(source) DO UPDATE SET
         cursor = excluded.cursor,
         last_synced_at = datetime('now')`
    )
    .bind(source, cursor)
    .run();
}

/**
 * Delete items from a source that are no longer present (for RSS sources where items can disappear).
 * We pass in the set of IDs we just synced; anything else for that source gets deleted.
 */
export async function deleteStaleItems(db: D1Database, source: string, currentIds: string[]): Promise<void> {
  await deleteStaleItemsScoped(db, source, undefined, currentIds);
}

/**
 * Delete records missing from the latest complete source snapshot.
 *
 * Fetch stale IDs first, then delete those IDs in batches. Splitting a NOT IN
 * list into batches is unsafe because each batch would delete IDs retained by
 * the other batches.
 */
export async function deleteStaleItemsScoped(
  db: D1Database,
  source: string,
  type: string | undefined,
  currentIds: string[]
): Promise<void> {
  const selectSql = type
    ? 'SELECT id FROM items WHERE source = ? AND type = ?'
    : 'SELECT id FROM items WHERE source = ?';
  const existing = type
    ? await db.prepare(selectSql).bind(source, type).all()
    : await db.prepare(selectSql).bind(source).all();
  const staleIds = findStaleItemIds(
    existing.results.map((row) => String(row.id)),
    currentIds
  );

  const BATCH = 100;
  for (let i = 0; i < staleIds.length; i += BATCH) {
    const batch = staleIds.slice(i, i + BATCH);
    const placeholders = batch.map(() => '?').join(',');
    await db
      .prepare(`DELETE FROM items WHERE id IN (${placeholders})`)
      .bind(...batch)
      .run();
  }
}

export function findStaleItemIds(existingIds: string[], currentIds: string[]): string[] {
  const currentIdSet = new Set(currentIds);
  return existingIds.filter((id) => !currentIdSet.has(id));
}

export interface FriendRssState {
  rssUrl: string | null;
  rssCheckedAt: string | null;
  rssError: string | null;
}

export async function upsertFriend(db: D1Database, friend: NotionFriend): Promise<void> {
  await db.prepare(
    `INSERT INTO friends (
       id, title, url, icon_url, description, rss_url,
       source_created_at, source_updated_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       url = excluded.url,
       icon_url = excluded.icon_url,
       description = excluded.description,
       latest_post_title = CASE WHEN friends.rss_url IS excluded.rss_url THEN friends.latest_post_title ELSE NULL END,
       latest_post_url = CASE WHEN friends.rss_url IS excluded.rss_url THEN friends.latest_post_url ELSE NULL END,
       latest_post_published_at = CASE WHEN friends.rss_url IS excluded.rss_url THEN friends.latest_post_published_at ELSE NULL END,
       rss_checked_at = CASE WHEN friends.rss_url IS excluded.rss_url THEN friends.rss_checked_at ELSE NULL END,
       rss_error = CASE WHEN friends.rss_url IS excluded.rss_url THEN friends.rss_error ELSE NULL END,
       rss_url = excluded.rss_url,
       source_created_at = excluded.source_created_at,
       source_updated_at = excluded.source_updated_at,
       updated_at = datetime('now')`
  ).bind(
    friend.id,
    friend.title,
    friend.url,
    friend.iconUrl || null,
    friend.description || null,
    friend.rssUrl || null,
    friend.createdAt.toISOString(),
    friend.updatedAt.toISOString()
  ).run();
}

export async function getFriendRssState(db: D1Database, id: string): Promise<FriendRssState | null> {
  const row = await db.prepare('SELECT rss_url, rss_checked_at, rss_error FROM friends WHERE id = ?').bind(id).first();
  return row ? {
    rssUrl: row.rss_url ?? null,
    rssCheckedAt: row.rss_checked_at ?? null,
    rssError: row.rss_error ?? null,
  } : null;
}

export async function updateFriendLatestPost(
  db: D1Database,
  id: string,
  latestPost: LatestFriendPost | null
): Promise<void> {
  await db.prepare(
    `UPDATE friends SET
       latest_post_title = ?, latest_post_url = ?, latest_post_published_at = ?,
       rss_checked_at = datetime('now'), rss_error = NULL, updated_at = datetime('now')
     WHERE id = ?`
  ).bind(
    latestPost?.title || null,
    latestPost?.url || null,
    latestPost?.publishedAt || null,
    id
  ).run();
}

export async function recordFriendRssError(db: D1Database, id: string, error: string): Promise<void> {
  await db.prepare(
    `UPDATE friends SET rss_checked_at = datetime('now'), rss_error = ?, updated_at = datetime('now') WHERE id = ?`
  ).bind(error.slice(0, 500), id).run();
}

export async function deleteStaleFriends(db: D1Database, currentIds: string[]): Promise<void> {
  const existing = await db.prepare('SELECT id FROM friends').all();
  const staleIds = findStaleItemIds(existing.results.map((row) => String(row.id)), currentIds);
  for (let i = 0; i < staleIds.length; i += 100) {
    const batch = staleIds.slice(i, i + 100);
    const placeholders = batch.map(() => '?').join(',');
    await db.prepare(`DELETE FROM friends WHERE id IN (${placeholders})`).bind(...batch).run();
  }
}

/**
 * Acquire a global sync lease. A stale lease can be replaced after 15 minutes
 * so an interrupted Worker invocation cannot block future cron runs forever.
 */
export async function tryAcquireSyncLock(db: D1Database): Promise<boolean> {
  const result = await db
    .prepare(
      `INSERT INTO sync_locks (name, acquired_at)
       VALUES ('global', datetime('now'))
       ON CONFLICT(name) DO UPDATE SET acquired_at = excluded.acquired_at
       WHERE sync_locks.acquired_at < datetime('now', '-15 minutes')`
    )
    .run();

  return Number(result?.meta?.changes || 0) > 0;
}

export async function releaseSyncLock(db: D1Database): Promise<void> {
  await db.prepare(`DELETE FROM sync_locks WHERE name = 'global'`).run();
}

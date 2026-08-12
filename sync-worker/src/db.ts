/**
 * D1 database helpers for the sync worker.
 * Handles upserting items, article bodies, and sync state.
 */

import type { FeedItem } from '../../src/lib/types';

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
      `INSERT INTO items (id, type, source, title, content, url, image, date, metadata_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         type = excluded.type,
         source = excluded.source,
         title = excluded.title,
         content = excluded.content,
         url = excluded.url,
         image = excluded.image,
         date = excluded.date,
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
  if (currentIds.length === 0) return;

  // Delete items that belong to this source but aren't in currentIds
  // Do it in batches to avoid SQL parameter limits
  const BATCH = 100;
  for (let i = 0; i < currentIds.length; i += BATCH) {
    const batch = currentIds.slice(i, i + BATCH);
    const placeholders = batch.map(() => '?').join(',');
    await db
      .prepare(
        `DELETE FROM items WHERE source = ? AND id NOT IN (${placeholders})`
      )
      .bind(source, ...batch)
      .run();
  }
}

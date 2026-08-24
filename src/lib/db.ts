/**
 * D1 database read module for the Astro/Cloudflare Pages app.
 *
 * All page-level data access now goes through this module, reading from D1
 * instead of making real-time API calls to third-party sources.
 */

import type { FeedItem, FeedItemType, ContentSource, ArchiveGroup, ArchiveItem, CurrentItem, ManualGame, SteamSnapshot, SteamStatus, FeedCursor, FeedPage, FeedStats } from './types';

// ============================================================
// D1 binding access
// ============================================================

interface D1Result {
  results: any[];
  success: boolean;
  meta?: any;
}

interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first(): Promise<any>;
  all(): Promise<D1Result>;
  run(): Promise<D1Result>;
}

interface D1DatabaseLike {
  prepare(sql: string): D1PreparedStatement;
}

let _runtimeDB: D1DatabaseLike | null = null;

/**
 * Set the D1 binding from Cloudflare runtime env (called from pages/API routes).
 */
export function setRuntimeDB(env: Record<string, any>): void {
  if (env?.DB) {
    _runtimeDB = env.DB;
  }
}

/**
 * Check if D1 is available.
 */
export function isDBAvailable(): boolean {
  return _runtimeDB !== null;
}

function getDB(): D1DatabaseLike {
  if (!_runtimeDB) {
    throw new Error('D1 database binding is not available. Call setRuntimeDB() first.');
  }
  return _runtimeDB;
}

// ============================================================
// Row → FeedItem mapping
// ============================================================

function rowToFeedItem(row: any): FeedItem {
  const metadata = row.metadata_json ? JSON.parse(row.metadata_json) : undefined;
  if (row.type === 'photo' && row.source === 'notion' && row.image) {
    if (metadata?.notionImage?.pageId) {
      const { pageId, property, index } = metadata.notionImage;
      row.image = `/api/notion-image?page=${encodeURIComponent(pageId)}&property=${encodeURIComponent(property)}&index=${Number.isInteger(index) ? index : 0}`;
    } else if (isExpiringNotionFileUrl(row.image)) {
      row.image = `/api/notion-image?page=${encodeURIComponent(row.id)}&property=%E5%9B%BE%E7%89%87&index=0`;
    }
  }
  const item: FeedItem = {
    id: row.id,
    type: row.type as FeedItemType,
    source: row.source as ContentSource,
    title: row.title || undefined,
    content: row.content || '',
    date: new Date(row.date),
    url: row.url || undefined,
    image: row.image || undefined,
    metadata,
  };
  return item;
}

function isExpiringNotionFileUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.hostname === 'prod-files-secure.s3.us-west-2.amazonaws.com' &&
      url.searchParams.has('X-Amz-Signature')
    );
  } catch {
    return false;
  }
}

// ============================================================
// Query functions
// ============================================================

/**
 * Get all feed items, optionally filtered by type, sorted by date descending.
 */
export async function queryItems(options?: {
  types?: FeedItemType[];
  limit?: number;
  cursor?: FeedCursor;
}): Promise<FeedItem[]> {
  const db = getDB();

  let sql = 'SELECT * FROM items';
  const params: any[] = [];
  const conditions: string[] = [];

  const types = options?.types;
  if (!types || types.includes('media')) {
    conditions.push(`NOT (type = 'media' AND source = 'notion')`);
  }

  if (types && types.length > 0) {
    const placeholders = types.map(() => '?').join(',');
    conditions.push(`type IN (${placeholders})`);
    params.push(...types);
  }

  if (options?.cursor) {
    conditions.push('(date < ? OR (date = ? AND id < ?))');
    params.push(options.cursor.date, options.cursor.date, options.cursor.id);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY date DESC, id DESC';

  if (options?.limit) {
    sql += ' LIMIT ?';
    params.push(options.limit);
  }

  const stmt = db.prepare(sql);
  const bound = params.length > 0 ? stmt.bind(...params) : stmt;
  const result = await bound.all();

  return result.results.map(rowToFeedItem);
}

export async function queryFeedPage(options: {
  limit: number;
  cursor?: FeedCursor;
}): Promise<FeedPage> {
  const rows = await queryItems({ limit: options.limit + 1, cursor: options.cursor });
  const hasMore = rows.length > options.limit;
  const items = hasMore ? rows.slice(0, options.limit) : rows;
  const lastItem = items.at(-1);

  return {
    items,
    nextCursor: hasMore && lastItem
      ? encodeFeedCursor({ date: lastItem.date.toISOString(), id: lastItem.id })
      : null,
  };
}

export async function queryFeedStats(): Promise<FeedStats> {
  const result = await getDB()
    .prepare(
      `SELECT type, COUNT(*) AS count
       FROM items
       WHERE NOT (type = 'media' AND source = 'notion')
       GROUP BY type`
    )
    .all();
  const stats: FeedStats = { articles: 0, photos: 0, microblogs: 0, media: 0 };

  for (const row of result.results) {
    const count = Number(row.count || 0);
    if (row.type === 'article') stats.articles = count;
    if (row.type === 'photo') stats.photos = count;
    if (row.type === 'microblog') stats.microblogs = count;
    if (row.type === 'media') stats.media = count;
  }

  return stats;
}

export function encodeFeedCursor(cursor: FeedCursor): string {
  const bytes = new TextEncoder().encode(JSON.stringify(cursor));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export function decodeFeedCursor(value: string): FeedCursor | null {
  try {
    const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || typeof parsed.date !== 'string' || typeof parsed.id !== 'string') return null;
    if (Number.isNaN(Date.parse(parsed.date)) || parsed.id.length === 0) return null;
    return { date: parsed.date, id: parsed.id };
  } catch {
    return null;
  }
}

/**
 * Get a single article by slug (URL suffix), including full HTML body.
 */
export async function queryArticleBySlug(slug: string): Promise<FeedItem | null> {
  const db = getDB();

  // Match by URL ending or ID
  const row = await db
    .prepare(
      `SELECT i.*, b.html, b.reading_time
       FROM items i
       LEFT JOIN article_bodies b ON i.id = b.item_id
       WHERE i.type = 'article' AND (i.url LIKE ? OR i.id = ?)
       LIMIT 1`
    )
    .bind(`%/${slug}`, slug)
    .first();

  if (!row) return null;

  const item = rowToFeedItem(row);

  // Merge body HTML into content and reading_time into metadata
  if (row.html) {
    item.content = row.html;
  }
  if (row.reading_time && item.metadata) {
    (item.metadata as any).readingTime = row.reading_time;
  } else if (row.reading_time) {
    item.metadata = { readingTime: row.reading_time } as any;
  }

  return item;
}

/**
 * Get all article slugs for route generation.
 */
export async function queryAllArticleSlugs(): Promise<string[]> {
  const db = getDB();

  const result = await db
    .prepare(`SELECT url, id FROM items WHERE type = 'article' ORDER BY date DESC`)
    .all();

  return result.results.map((row: any) => {
    const url = row.url || '';
    const slug = url.split('/').pop() || row.id;
    return slug;
  });
}

/**
 * Get archive items grouped by year.
 */
export async function queryArchiveGroups(): Promise<ArchiveGroup[]> {
  const db = getDB();

  const result = await db
    .prepare(
    `SELECT id, title, date, type, url FROM items
     WHERE type = 'article'
     ORDER BY date DESC`
    )
    .all();

  const grouped: Record<number, ArchiveItem[]> = {};

  for (const row of result.results) {
    const year = new Date(row.date).getFullYear();
    if (!grouped[year]) grouped[year] = [];

    grouped[year].push({
      id: row.id,
      title: row.title || 'Untitled',
      date: new Date(row.date),
      type: row.type as FeedItemType,
      url: row.url || '',
    });
  }

  const groups: ArchiveGroup[] = Object.keys(grouped)
    .map(Number)
    .sort((a, b) => b - a)
    .map((year) => ({
      year,
      items: grouped[year],
      count: grouped[year].length,
    }));

  return groups;
}

/**
 * Get photos grouped by year.
 */
export async function queryPhotosByYear(): Promise<Record<number, FeedItem[]>> {
  const db = getDB();

  const result = await db
    .prepare(
      `SELECT * FROM items WHERE type = 'photo' ORDER BY date DESC`
    )
    .all();

  const grouped: Record<number, FeedItem[]> = {};

  for (const row of result.results) {
    const item = rowToFeedItem(row);
    const year = item.date.getFullYear();
    if (!grouped[year]) grouped[year] = [];
    grouped[year].push(item);
  }

  // Sort years descending
  const sorted: Record<number, FeedItem[]> = {};
  for (const year of Object.keys(grouped).map(Number).sort((a, b) => b - a)) {
    sorted[year] = grouped[year];
  }

  return sorted;
}

/**
 * Get "currently consuming" items (in-progress media from Notion + Douban).
 */
export async function queryCurrentItems(): Promise<CurrentItem[]> {
  const db = getDB();

  const result = await db
    .prepare(
      `SELECT * FROM items
       WHERE type = 'media' AND source = 'notion'
       AND json_extract(metadata_json, '$.mediaType') != 'game'
       ORDER BY date DESC
       LIMIT 50`
    )
    .all();

  const currentItems: CurrentItem[] = [];

  for (const row of result.results) {
    const metadata = row.metadata_json ? JSON.parse(row.metadata_json) : {};
    const endDateStr = metadata.endDate;
    if (endDateStr) {
      // A recorded end date takes precedence over stale or unrecognized status
      // labels. Keep recently completed items alongside in-progress ones.
      const endDate = new Date(endDateStr);
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      if (Number.isNaN(endDate.getTime()) || endDate < fourteenDaysAgo) continue;
    } else {
      // No endDate: only show items still in progress
      if (metadata.status !== 'in_progress') continue;
    }

    const mediaType = metadata.mediaType;
    let itemType: CurrentItem['type'];
    switch (mediaType) {
      case 'book':
      case 'manga':
        itemType = 'reading';
        break;
      case 'music':
        itemType = 'listening';
        break;
      case 'game':
        itemType = 'playing';
        break;
      default:
        itemType = 'watching';
    }


    currentItems.push({
      type: itemType,
      mediaType,
      title: row.title || '',
      cover: row.image || undefined,
      date: new Date(row.date),
      url: row.url || undefined,
      ...(endDateStr ? { endDate: new Date(endDateStr) } : {}),
    });
  }

  return currentItems
    .sort((item, otherItem) => {
      const itemSortTime = (item.endDate || item.date).getTime();
      const otherSortTime = (otherItem.endDate || otherItem.date).getTime();
      return otherSortTime - itemSortTime;
    })
    .slice(0, 8);
}

export async function queryCurrentGames(): Promise<ManualGame[]> {
  const db = getDB();
  const result = await db
    .prepare(
      `SELECT id, title, image, url, date FROM items
       WHERE type = 'media' AND source = 'notion'
       AND json_extract(metadata_json, '$.mediaType') = 'game'
       AND json_extract(metadata_json, '$.status') = 'in_progress'
       ORDER BY date DESC
       LIMIT 4`
    )
    .all();

  return result.results.map((row: any) => ({
    id: row.id,
    title: row.title || '',
    cover: row.image || undefined,
    url: row.url || undefined,
    date: row.date ? new Date(row.date) : undefined,
  }));
}

export async function querySteamSnapshot(): Promise<SteamSnapshot> {
  const db = getDB();
  const gameRows = await db
    .prepare('SELECT * FROM steam_games ORDER BY display_order ASC')
    .all();
  const stateRow = await db
    .prepare('SELECT * FROM steam_state WHERE id = 1')
    .first();

  const status: SteamStatus = {
    online: Boolean(stateRow?.online),
    currentGameId: stateRow?.current_game_id ?? undefined,
    currentGameName: stateRow?.current_game_name ?? undefined,
    avatar: stateRow?.avatar ?? undefined,
  };

  return {
    games: gameRows.results.map((row: any) => ({
      id: row.appid,
      name: row.name,
      cover: row.cover,
      url: row.url,
      playtimeForeverMinutes: row.playtime_forever_minutes,
      playtimeTwoWeeksMinutes: row.playtime_two_weeks_minutes,
    })),
    status,
  };
}

/**
 * Source-specific sync functions.
 * Each function pulls data from a third-party source and writes it to D1.
 */

import { setRuntimeEnv } from '../../src/lib/api/env';
import { fetchArticles, fetchArticle } from '../../src/lib/api/notion/articles';
import { fetchPhotos } from '../../src/lib/api/notion/photos';
import { fetchNotionFriends } from '../../src/lib/api/notion/friends';
import { getAllTelegramMessages } from '../../src/lib/api/telegram';
import { fetchDoubanFeed } from '../../src/lib/api/rss';
import { getSteamGames, getSteamStatus } from '../../src/lib/steam';
import { calculateReadingTime } from '../../src/lib/api/notion/blocks-to-html';
import type { FeedItem } from '../../src/lib/types';

import { upsertItem, upsertArticleBody, getSyncState, updateSyncState, deleteStaleItems, deleteStaleItemsScoped, upsertFriend, getFriendRssState, updateFriendLatestPost, recordFriendRssError, deleteStaleFriends } from './db';
import { ensureBookmarksEnriched, createBookmarkResolver } from './link-enricher';
import { fetchLatestFriendPost } from './friend-rss';
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

  await deleteStaleItemsScoped(db, 'notion', 'article', allArticleItems.filter((item) => item.type === 'article').map((item) => item.id));
  await deleteStaleItemsScoped(db, 'notion', 'page', allArticleItems.filter((item) => item.type === 'page').map((item) => item.id));

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

const FRIEND_RSS_TTL_MS = 6 * 60 * 60 * 1000;
const FRIEND_RSS_ERROR_TTL_MS = 30 * 60 * 1000;

export function shouldRefreshFriendRss(checkedAt: string | null, now = Date.now(), hasError = false): boolean {
  if (!checkedAt) return true;
  const checkedTime = Date.parse(checkedAt);
  const ttl = hasError ? FRIEND_RSS_ERROR_TTL_MS : FRIEND_RSS_TTL_MS;
  return Number.isNaN(checkedTime) || now - checkedTime >= ttl;
}

export async function syncNotionFriends(db: D1Database, env: Record<string, string>): Promise<void> {
  setRuntimeEnv(env);
  const friends = await fetchNotionFriends();

  for (const friend of friends) {
    const previous = await getFriendRssState(db, friend.id);
    await upsertFriend(db, friend);
    if (!friend.rssUrl) continue;

    const rssChanged = previous?.rssUrl !== friend.rssUrl;
    if (!rssChanged && !shouldRefreshFriendRss(previous?.rssCheckedAt ?? null, Date.now(), Boolean(previous?.rssError))) continue;

    try {
      const latestPost = await fetchLatestFriendPost(friend.rssUrl);
      await updateFriendLatestPost(db, friend.id, latestPost);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await recordFriendRssError(db, friend.id, message);
      console.error(JSON.stringify({ event: 'friends.rss.failed', id: friend.id, rssUrl: friend.rssUrl, error: message }));
    }
  }

  await deleteStaleFriends(db, friends.map((friend) => friend.id));
  await updateSyncState(db, 'notion:friends', null);
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

/**
 * Sync Notion "现在在看" (currently consuming) items.
 */
export async function syncNotionCurrent(db: D1Database, env: Record<string, string>): Promise<void> {
  setRuntimeEnv(env);

  const { getAllCurrentItems } = await import('../../src/lib/api/notion/current');
  const allItems: FeedItem[] = await getAllCurrentItems();

  for (const item of allItems) {
    await upsertItem(db, item);
  }

  await deleteStaleItemsScoped(db, 'notion', 'media', allItems.map((item) => item.id));
  await updateSyncState(db, 'notion:current', null);
}

export async function syncSteam(db: D1Database, env: Record<string, string>): Promise<void> {
  const steamId = env.STEAM_ID;
  const apiKey = env.STEAM_API_KEY;
  if (!steamId || !apiKey) {
    throw new Error('Steam sync requires STEAM_ID and STEAM_API_KEY');
  }

  const [games, status] = await Promise.all([
    getSteamGames(steamId, apiKey),
    getSteamStatus(steamId, apiKey),
  ]);

  for (const [index, game] of games.entries()) {
    await db
      .prepare(
        `INSERT INTO steam_games (
           appid, name, cover, url, playtime_forever_minutes,
           playtime_two_weeks_minutes, display_order, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(appid) DO UPDATE SET
           name = excluded.name,
           cover = excluded.cover,
           url = excluded.url,
           playtime_forever_minutes = excluded.playtime_forever_minutes,
           playtime_two_weeks_minutes = excluded.playtime_two_weeks_minutes,
           display_order = excluded.display_order,
           updated_at = excluded.updated_at`
      )
      .bind(
        game.id,
        game.name,
        game.cover,
        game.url,
        game.playtimeForeverMinutes,
        game.playtimeTwoWeeksMinutes,
        index
      )
      .run();
  }

  if (games.length > 0) {
    const appIds = games.map((game) => game.id);
    const placeholders = appIds.map(() => '?').join(',');
    await db
      .prepare(`DELETE FROM steam_games WHERE appid NOT IN (${placeholders})`)
      .bind(...appIds)
      .run();
  }

  await db
    .prepare(
      `INSERT INTO steam_state (
         id, online, current_game_id, current_game_name, avatar, synced_at
       ) VALUES (1, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         online = excluded.online,
         current_game_id = excluded.current_game_id,
         current_game_name = excluded.current_game_name,
         avatar = excluded.avatar,
         synced_at = excluded.synced_at`
    )
    .bind(
      status.online ? 1 : 0,
      status.currentGameId ?? null,
      status.currentGameName ?? null,
      status.avatar ?? null
    )
    .run();

  await updateSyncState(db, 'steam', null);
}

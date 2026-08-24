/**
 * "Currently consuming" items from Notion
 * Tracks books, manga, anime, games, films, music the user is currently enjoying.
 */

import type { QueryDatabaseParameters } from '@notionhq/client/build/src/api-endpoints';
import type { RichTextItemResponse } from '@notionhq/client/build/src/api-endpoints';
import type { FeedItem, MediaMetadata } from '../../types';
import { getNotionClient, getCurrentDatabaseId } from './client';
import { getPlainText, getCoverImage } from './properties';

/**
 * Notion "现在在看" database properties (Chinese field names).
 */
interface NotionCurrentProperties {
  名称?: { title: RichTextItemResponse[] };
  类型?: { select: { name: string } | null };
  状态?: { status: { name: string } | null };
  封面?: { files: { type: string; file?: { url: string }; external?: { url: string } }[] };
  链接?: { url: string | null };
  Link?: { url: string | null };
  开始时间?: { date: { start: string } | null };
  结束时间?: { date: { start: string } | null };
}

/**
 * Map Notion select type to our mediaType.
 */
function mapMediaType(type: string | null): MediaMetadata['mediaType'] {
  switch (type) {
    case '书籍': return 'book';
    case '漫画': return 'manga';
    case '番剧': return 'anime';
    case '游戏': return 'game';
    case '电影': return 'movie';
    case '音乐': return 'music';
    default: return 'book';
  }
}

/**
 * Map Notion status name to our status.
 */
function mapStatus(status: string | null): MediaMetadata['status'] {
  switch (status) {
    case '在看':
    case '进行中':
    case '在看中':
      return 'in_progress';
    case '已完成':
    case '已看完':
    case '看完':
      return 'completed';
    case '搁置':
      return 'paused';
    case '未开始':
    case '计划中':
    default:
      return 'wishlist';
  }
}

/**
 * Fetch all items from the "现在在看" Notion database.
 */
export async function fetchCurrentItems(options?: {
  pageSize?: number;
  startCursor?: string | null;
}): Promise<{ items: FeedItem[]; hasMore: boolean; nextCursor: string | null }> {
  const dbId = getCurrentDatabaseId();
  if (!dbId) {
    console.warn('NOTION_CURRENT_DATABASE_ID is not set, returning empty current items');
    return { items: [], hasMore: false, nextCursor: null };
  }

  const notion = getNotionClient();
  const query: QueryDatabaseParameters = {
    database_id: dbId,
    sorts: [{ property: '开始时间', direction: 'descending' }],
    page_size: options?.pageSize || 100,
    start_cursor: options?.startCursor || undefined,
  };

  const response = await notion.databases.query(query);

  const items: FeedItem[] = response.results.map((page) => {
    const props = (page as any).properties as NotionCurrentProperties;
    const title = getPlainText(props.名称?.title);
    const typeStr = props.类型?.select?.name ?? null;
    const statusStr = props.状态?.status?.name ?? null;
    const cover = getCoverImage(props.封面?.files);
    const url = props.链接?.url || props.Link?.url || undefined;
    const startStr = props.开始时间?.date?.start;
    const endStr = props.结束时间?.date?.start;

    const mediaType = mapMediaType(typeStr);
    // A recorded end date is a stronger completion signal than the Notion status
    // label, whose wording may not be covered by mapStatus yet.
    const status: MediaMetadata['status'] = endStr ? 'completed' : mapStatus(statusStr);

    // Use start date as primary (for sorting), fallback to end date, fallback to page creation time
    const dateStr = startStr || endStr;
    const date = dateStr ? new Date(dateStr) : new Date((page as any).created_time);

    const metadata: MediaMetadata = {
      mediaType,
      status,
    };
    if (endStr) {
      metadata.endDate = endStr;
    }

    return {
      id: page.id,
      type: 'media' as const,
      title,
      content: '',
      date,
      source: 'notion' as const,
      url,
      image: cover,
      metadata,
    };
  });

  return { items, hasMore: response.has_more, nextCursor: response.next_cursor };
}

/**
 * Fetch all current items with pagination.
 */
export async function getAllCurrentItems(): Promise<FeedItem[]> {
  const all: FeedItem[] = [];
  let hasMore = true;
  let cursor: string | null = null;

  while (hasMore) {
    const { items, hasMore: more, nextCursor } = await fetchCurrentItems({
      pageSize: 100,
      startCursor: cursor,
    });
    all.push(...items);
    hasMore = more;
    cursor = nextCursor;
  }

  return all;
}

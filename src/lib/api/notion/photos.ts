/**
 * Photo fetching from Notion
 * (KV caching removed — data now lives in D1, populated by the sync worker)
 */

import type { QueryDatabaseParameters } from '@notionhq/client/build/src/api-endpoints';
import type { FeedItem } from '../../types';
import { getNotionClient, getPhotosDatabaseId } from './client';
import { type NotionPhotoProperties, getPlainText, getCoverImage } from './properties';

/**
 * Fetch photos from Notion database
 */
export async function fetchPhotos(options?: {
  pageSize?: number;
  startCursor?: string | null;
}): Promise<{ photos: FeedItem[]; hasMore: boolean; nextCursor: string | null }> {
  const dbId = getPhotosDatabaseId();
  if (!dbId) {
    console.warn('NOTION_PHOTOS_DATABASE_ID is not set, returning empty photos');
    return { photos: [], hasMore: false, nextCursor: null };
  }

  const notion = getNotionClient();
  const query: QueryDatabaseParameters = {
    database_id: dbId,
    filter: { property: '发布', checkbox: { equals: true } },
    sorts: [{ property: '日期', direction: 'descending' }],
    page_size: options?.pageSize || 20,
    start_cursor: options?.startCursor || undefined,
  };

  const response = await notion.databases.query(query);

  const photos: FeedItem[] = response.results.map((page) => {
    const props = (page as any).properties as NotionPhotoProperties;
    const title = getPlainText(props.标题?.title || props.Title?.title);
    const dateStr = props.日期?.date?.start || props.Date?.date?.start;
    const date = dateStr ? new Date(dateStr) : new Date((page as any).created_time);
    const location = getPlainText(props.地点?.rich_text || props.Location?.rich_text);
    const image = getCoverImage(props.图片?.files || props.Image?.files);

    return {
      id: page.id,
      type: 'photo' as const,
      title,
      content: '',
      date,
      source: 'notion' as const,
      url: `/photos/${page.id}`,
      image,
      metadata: { location },
    };
  });

  return { photos, hasMore: response.has_more, nextCursor: response.next_cursor };
}

/**
 * Get all photos with pagination
 */
export async function getAllPhotos(): Promise<FeedItem[]> {
  const all: FeedItem[] = [];
  let hasMore = true;
  let cursor: string | null = null;

  while (hasMore) {
    const { photos, hasMore: more, nextCursor } = await fetchPhotos({
      pageSize: 100,
      startCursor: cursor,
    });
    all.push(...photos);
    hasMore = more;
    cursor = nextCursor;
  }

  return all;
}

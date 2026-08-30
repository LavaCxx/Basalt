import type { QueryDatabaseParameters } from '@notionhq/client/build/src/api-endpoints';
import { getFriendsDatabaseId, getNotionClient } from './client';
import { getPlainText, type NotionFriendProperties } from './properties';

export interface NotionFriend {
  id: string;
  title: string;
  url: string;
  iconUrl?: string;
  description?: string;
  rssUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function fetchNotionFriends(): Promise<NotionFriend[]> {
  const databaseId = getFriendsDatabaseId();
  if (!databaseId) return [];

  const notion = getNotionClient();
  const friends: NotionFriend[] = [];
  let cursor: string | undefined;

  do {
    const query: QueryDatabaseParameters = {
      database_id: databaseId,
      sorts: [{ timestamp: 'created_time', direction: 'ascending' }],
      page_size: 100,
      start_cursor: cursor,
    };
    const response = await notion.databases.query(query);

    for (const result of response.results) {
      const page = result as any;
      const props = page.properties as NotionFriendProperties;
      const title = getPlainText(props.名称?.title).trim();
      const url = props.博客地址?.url?.trim() || '';
      if (!title || !isHttpUrl(url)) {
        console.warn(JSON.stringify({ event: 'friends.invalid', id: page.id, title, url }));
        continue;
      }

      friends.push({
        id: page.id,
        title,
        url,
        iconUrl: optionalHttpUrl(props.头像地址?.url),
        description: getPlainText(props.描述?.rich_text).trim() || undefined,
        rssUrl: optionalHttpUrl(props.RSS地址?.url),
        createdAt: new Date(page.created_time),
        updatedAt: new Date(page.last_edited_time),
      });
    }

    cursor = response.has_more ? response.next_cursor || undefined : undefined;
  } while (cursor);

  return friends;
}

function optionalHttpUrl(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && isHttpUrl(trimmed) ? trimmed : undefined;
}

function isHttpUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

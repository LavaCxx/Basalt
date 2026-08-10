/**
 * Article fetching from Notion
 */

import type { QueryDatabaseParameters } from '@notionhq/client/build/src/api-endpoints';
import type { FeedItem, ArticleMetadata } from '../../types';
import { getNotionClient, getArticlesDatabaseId, CACHE_KEYS, CACHE_TTL_SECONDS, withKVCache, isKVAvailable } from './client';
import { type NotionArticleProperties, getPlainText, getCoverImage } from './properties';
import { fetchBlockChildren, calculateReadingTime } from './blocks-to-html';

/**
 * Fetch articles from Notion database
 */
export async function fetchArticles(options?: {
  pageSize?: number;
  startCursor?: string;
}): Promise<{ articles: FeedItem[]; hasMore: boolean; nextCursor: string | null }> {
  const dbId = getArticlesDatabaseId();
  if (!dbId) {
    console.warn('NOTION_ARTICLES_DATABASE_ID is not set, returning empty articles');
    return { articles: [], hasMore: false, nextCursor: null };
  }

  const notion = getNotionClient();
  const query: QueryDatabaseParameters = {
    database_id: dbId,
    filter: { property: '发布', checkbox: { equals: true } },
    sorts: [{ timestamp: 'created_time', direction: 'descending' }],
    page_size: options?.pageSize || 10,
    start_cursor: options?.startCursor,
  };

  const response = await notion.databases.query(query);

  const articles: FeedItem[] = response.results.map((page) => {
    const props = (page as any).properties as NotionArticleProperties;
    const title = getPlainText(props.标题?.title || props.标题_EN?.title || props.Title?.title);
    const excerpt = getPlainText(props.摘要?.rich_text || props.Excerpt?.rich_text);
    const tags = (props.标签?.multi_select || props.Tags?.multi_select || []).map((t) => t.name);
    const featured = props.精选?.checkbox ?? props.Featured?.checkbox ?? false;
    const date = new Date((page as any).created_time);
    const image = getCoverImage(props.封面?.files || props.Cover?.files);
    const slug = getPlainText(props.Slug?.rich_text || props.slug?.rich_text) || page.id;

    return {
      id: page.id,
      type: 'article' as const,
      title,
      content: '',
      date,
      source: 'notion' as const,
      url: `/articles/${slug}`,
      image,
      metadata: { excerpt, tags, featured, readingTime: 5 } as ArticleMetadata,
    };
  });

  return { articles, hasMore: response.has_more, nextCursor: response.next_cursor };
}

/**
 * Fetch a single article with full content (with KV cache)
 */
export async function fetchArticle(pageId: string): Promise<FeedItem | null> {
  const cacheKey = `${CACHE_KEYS.ARTICLE_PREFIX}${pageId}`;
  if (isKVAvailable()) {
    return withKVCache<FeedItem | null>(cacheKey, () => fetchArticleInternal(pageId), CACHE_TTL_SECONDS);
  }
  return fetchArticleInternal(pageId);
}

async function fetchArticleInternal(pageId: string): Promise<FeedItem | null> {
  try {
    const notion = getNotionClient();
    const page = await notion.pages.retrieve({ page_id: pageId });
    const props = (page as any).properties as NotionArticleProperties;

    const title = getPlainText(props.标题?.title || props.标题_EN?.title || props.Title?.title);
    const excerpt = getPlainText(props.摘要?.rich_text || props.Excerpt?.rich_text);
    const tags = (props.标签?.multi_select || props.Tags?.multi_select || []).map((t) => t.name);
    const featured = props.精选?.checkbox ?? props.Featured?.checkbox ?? false;
    const date = new Date((page as any).created_time);
    const image = getCoverImage(props.封面?.files || props.Cover?.files);
    const slug = getPlainText(props.Slug?.rich_text || props.slug?.rich_text) || page.id;
    const content = await fetchBlockChildren(pageId);

    return {
      id: page.id,
      type: 'article',
      title,
      content,
      date,
      source: 'notion',
      url: `/articles/${slug}`,
      image,
      metadata: { excerpt, tags, featured, readingTime: calculateReadingTime(content) },
    };
  } catch (error) {
    console.error(`Error fetching article ${pageId}:`, error);
    return null;
  }
}

/**
 * Get all articles with pagination + KV cache
 */
export async function getAllArticles(): Promise<FeedItem[]> {
  if (isKVAvailable()) {
    return withKVCache<FeedItem[]>(CACHE_KEYS.ARTICLES, fetchAllArticlesInternal, CACHE_TTL_SECONDS);
  }
  return fetchAllArticlesInternal();
}

async function fetchAllArticlesInternal(): Promise<FeedItem[]> {
  const all: FeedItem[] = [];
  let hasMore = true;
  let cursor: string | null = null;

  while (hasMore) {
    const { articles, hasMore: more, nextCursor } = await fetchArticles({
      pageSize: 100,
      startCursor: cursor || undefined,
    });
    all.push(...articles);
    hasMore = more;
    cursor = nextCursor;
  }

  return all;
}

/**
 * Notion API Client
 * Fetches content from Notion database and converts to FeedItem format
 */

import { Client } from '@notionhq/client';
import type {
  QueryDatabaseParameters,
  QueryDatabaseResponse,
  GetBlockResponse,
  RichTextItemResponse,
} from '@notionhq/client/build/src/api-endpoints';
import type { FeedItem, ArticleMetadata } from '../types';
import { withKVCache, isKVAvailable } from '../kv-cache';

// Cache TTL: 1 hour
const CACHE_TTL_SECONDS = 3600;

// Cache keys
const CACHE_KEYS = {
  ARTICLES: 'notion:articles:all',
  PHOTOS: 'notion:photos:all',
  ARTICLE_PREFIX: 'notion:article:',
};

/**
 * Get environment variable (works in both Astro and Node contexts)
 */
const getEnv = (key: string): string | undefined => {
  return (import.meta as any).env?.[key] || process.env[key];
};

// Lazy-initialized Notion client
let _notion: ReturnType<typeof Client> | null = null;

function getNotionClient() {
  if (!_notion) {
    const apiKey = getEnv('NOTION_API_KEY');
    if (!apiKey) {
      throw new Error('NOTION_API_KEY is not set');
    }
    _notion = new Client({ auth: apiKey });
  }
  return _notion;
}

// Get database IDs lazily
function getArticlesDatabaseId() {
  return getEnv('NOTION_ARTICLES_DATABASE_ID');
}

function getPhotosDatabaseId() {
  return getEnv('NOTION_PHOTOS_DATABASE_ID');
}

/**
 * Article properties in Notion database
 */
interface NotionArticleProperties {
  标题?: { title: RichTextItemResponse[] };
  标题_EN?: { title: RichTextItemResponse[] };
  Title?: { title: RichTextItemResponse[] };
  摘要?: { rich_text: RichTextItemResponse[] };
  Excerpt?: { rich_text: RichTextItemResponse[] };
  标签?: { multi_select: { name: string }[] };
  Tags?: { multi_select: { name: string }[] };
  精选?: { checkbox: boolean };
  Featured?: { checkbox: boolean };
  发布?: { checkbox: boolean };
  Published?: { checkbox: boolean };
  封面?: { files: { type: string; file?: { url: string }; external?: { url: string } }[] };
  Cover?: { files: { type: string; file?: { url: string }; external?: { url: string } }[] };
  Slug?: { rich_text: RichTextItemResponse[] };
  slug?: { rich_text: RichTextItemResponse[] };
}

/**
 * Photo properties in Notion database
 */
interface NotionPhotoProperties {
  标题?: { title: RichTextItemResponse[] };
  Title?: { title: RichTextItemResponse[] };
  日期?: { date: { start: string } | null };
  Date?: { date: { start: string } | null };
  相册?: { select: { name: string } | null };
  Album?: { select: { name: string } | null };
  地点?: { rich_text: RichTextItemResponse[] };
  Location?: { rich_text: RichTextItemResponse[] };
  图片?: { files: { type: string; file?: { url: string }; external?: { url: string } }[] };
  Image?: { files: { type: string; file?: { url: string }; external?: { url: string } }[] };
}

/**
 * Extract plain text from Notion rich text
 */
function getPlainText(richText: RichTextItemResponse[] | undefined): string {
  if (!richText) return '';
  return richText.map((text) => text.plain_text).join('');
}

/**
 * Get cover image URL from Notion page
 */
function getCoverImage(
  files: { type: string; file?: { url: string }; external?: { url: string } }[] | undefined
): string | undefined {
  if (!files || files.length === 0) return undefined;
  const file = files[0];
  if (file.type === 'file' && file.file) {
    return file.file.url;
  }
  if (file.type === 'external' && file.external) {
    return file.external.url;
  }
  return undefined;
}

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
    filter: {
      property: '发布',
      checkbox: { equals: true },
    },
    sorts: [
      {
        timestamp: 'created_time',
        direction: 'descending',
      },
    ],
    page_size: options?.pageSize || 10,
    start_cursor: options?.startCursor,
  };

  const response = await notion.databases.query(query);

  const articles: FeedItem[] = response.results.map((page) => {
    const props = (page as any).properties as NotionArticleProperties;

    // Extract title (support multiple property names)
    const title = getPlainText(props.标题?.title || props.标题_EN?.title || props.Title?.title);

    // Extract excerpt
    const excerpt = getPlainText(props.摘要?.rich_text || props.Excerpt?.rich_text);

    // Extract tags
    const tags = (props.标签?.multi_select || props.Tags?.multi_select || []).map(
      (tag) => tag.name
    );

    // Extract featured status
    const featured = props.精选?.checkbox ?? props.Featured?.checkbox ?? false;

    // Use Notion system timestamps
    const date = new Date((page as any).created_time);
    const lastEditedTime = new Date((page as any).last_edited_time);

    // Extract cover image
    const image = getCoverImage(props.封面?.files || props.Cover?.files);

    // Extract slug
    const slug = getPlainText(props.Slug?.rich_text || props.slug?.rich_text) || page.id;

    const metadata: ArticleMetadata = {
      excerpt,
      tags,
      featured,
      readingTime: 5, // Default, will be calculated later
    };

    return {
      id: page.id,
      type: 'article' as const,
      title,
      content: '', // Content will be fetched separately when needed
      date,
      source: 'notion' as const,
      url: `/articles/${slug}`,
      image,
      metadata,
    };
  });

  return {
    articles,
    hasMore: response.has_more,
    nextCursor: response.next_cursor,
  };
}

/**
 * Fetch a single article with full content
 * Uses KV cache when available
 */
export async function fetchArticle(pageId: string): Promise<FeedItem | null> {
  const cacheKey = `${CACHE_KEYS.ARTICLE_PREFIX}${pageId}`;

  // Use KV cache if available
  if (isKVAvailable()) {
    return withKVCache<FeedItem | null>(
      cacheKey,
      () => fetchArticleInternal(pageId),
      CACHE_TTL_SECONDS
    );
  }

  // Fallback: direct fetch without cache
  return fetchArticleInternal(pageId);
}

/**
 * Internal function to fetch a single article from Notion
 */
async function fetchArticleInternal(pageId: string): Promise<FeedItem | null> {
  try {
    const notion = getNotionClient();
    const page = await notion.pages.retrieve({ page_id: pageId });
    const props = (page as any).properties as NotionArticleProperties;

    // Extract all properties (same as above)
    const title = getPlainText(props.标题?.title || props.标题_EN?.title || props.Title?.title);
    const excerpt = getPlainText(props.摘要?.rich_text || props.Excerpt?.rich_text);
    const tags = (props.标签?.multi_select || props.Tags?.multi_select || []).map(
      (tag) => tag.name
    );
    const featured = props.精选?.checkbox ?? props.Featured?.checkbox ?? false;

    // Use Notion system timestamps
    const date = new Date((page as any).created_time);

    const image = getCoverImage(props.封面?.files || props.Cover?.files);
    const slug = getPlainText(props.Slug?.rich_text || props.slug?.rich_text) || page.id;

    // Fetch content blocks
    const content = await fetchBlockChildren(pageId);

    const metadata: ArticleMetadata = {
      excerpt,
      tags,
      featured,
      readingTime: calculateReadingTime(content),
    };

    return {
      id: page.id,
      type: 'article',
      title,
      content,
      date,
      source: 'notion',
      url: `/articles/${slug}`,
      image,
      metadata,
    };
  } catch (error) {
    console.error(`Error fetching article ${pageId}:`, error);
    return null;
  }
}

/**
 * Fetch photos from Notion database
 */
export async function fetchPhotos(options?: {
  pageSize?: number;
  startCursor?: string;
}): Promise<{ photos: FeedItem[]; hasMore: boolean; nextCursor: string | null }> {
  const dbId = getPhotosDatabaseId();
  if (!dbId) {
    console.warn('NOTION_PHOTOS_DATABASE_ID is not set, returning empty photos');
    return { photos: [], hasMore: false, nextCursor: null };
  }

  const notion = getNotionClient();
  const query: QueryDatabaseParameters = {
    database_id: dbId,
    filter: {
      property: '发布',
      checkbox: { equals: true },
    },
    sorts: [
      {
        timestamp: 'created_time',
        direction: 'descending',
      },
    ],
    page_size: options?.pageSize || 20,
    start_cursor: options?.startCursor,
  };

  const response = await notion.databases.query(query);

  const photos: FeedItem[] = response.results.map((page) => {
    const props = (page as any).properties as NotionPhotoProperties;

    const title = getPlainText(props.标题?.title || props.Title?.title);

    // Use Notion system timestamp
    const date = new Date((page as any).created_time);

    const album = props.相册?.select?.name || props.Album?.select?.name;
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
      metadata: {
        album,
        location,
      },
    };
  });

  return {
    photos,
    hasMore: response.has_more,
    nextCursor: response.next_cursor,
  };
}

/**
 * Fetch block children and convert to HTML
 */
async function fetchBlockChildren(blockId: string): Promise<string> {
  const notion = getNotionClient();
  const blocks = await notion.blocks.children.list({
    block_id: blockId,
    page_size: 100,
  });

  const htmlParts: string[] = [];

  for (const block of blocks.results) {
    const html = await blockToHtml(block);
    if (html) {
      htmlParts.push(html);
    }
  }

  return htmlParts.join('\n');
}

/**
 * Convert a Notion block to HTML
 */
async function blockToHtml(block: GetBlockResponse): Promise<string> {
  const b = block as any;

  switch (b.type) {
    case 'paragraph':
      return `<p>${richTextToHtml(b.paragraph.rich_text)}</p>`;

    case 'heading_1':
      return `<h1>${richTextToHtml(b.heading_1.rich_text)}</h1>`;

    case 'heading_2':
      return `<h2>${richTextToHtml(b.heading_2.rich_text)}</h2>`;

    case 'heading_3':
      return `<h3>${richTextToHtml(b.heading_3.rich_text)}</h3>`;

    case 'bulleted_list_item':
      return `<li>${richTextToHtml(b.bulleted_list_item.rich_text)}</li>`;

    case 'numbered_list_item':
      return `<li>${richTextToHtml(b.numbered_list_item.rich_text)}</li>`;

    case 'quote':
      return `<blockquote>${richTextToHtml(b.quote.rich_text)}</blockquote>`;

    case 'code':
      return `<pre><code class="language-${b.code.language}">${richTextToHtml(b.code.rich_text)}</code></pre>`;

    case 'image':
      const imageUrl = b.image.type === 'external' ? b.image.external.url : b.image.file.url;
      const caption = richTextToHtml(b.image.caption || []);
      return `<figure><img src="${imageUrl}" alt="${caption}" loading="lazy" />${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`;

    case 'divider':
      return '<hr />';

    case 'callout':
      const calloutText = richTextToHtml(b.callout.rich_text);
      return `<aside class="callout">${calloutText}</aside>`;

    case 'toggle':
      // For toggle, we'll just show the summary for now
      return `<details><summary>${richTextToHtml(b.toggle.rich_text)}</summary></details>`;

    default:
      // For unsupported blocks, try to get any text content
      if (b[b.type]?.rich_text) {
        return `<p>${richTextToHtml(b[b.type].rich_text)}</p>`;
      }
      return '';
  }
}

/**
 * Convert Notion rich text to HTML
 */
function richTextToHtml(richText: RichTextItemResponse[]): string {
  return richText
    .map((text) => {
      let content = text.plain_text;

      // Handle annotations
      if (text.annotations) {
        if (text.annotations.bold) {
          content = `<strong>${content}</strong>`;
        }
        if (text.annotations.italic) {
          content = `<em>${content}</em>`;
        }
        if (text.annotations.code) {
          content = `<code>${content}</code>`;
        }
        if (text.annotations.strikethrough) {
          content = `<s>${content}</s>`;
        }
        if (text.annotations.underline) {
          content = `<u>${content}</u>`;
        }
      }

      // Handle links
      if (text.href) {
        content = `<a href="${text.href}">${content}</a>`;
      }

      return content;
    })
    .join('');
}

/**
 * Calculate reading time in minutes
 */
function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const chineseCharsPerMinute = 400;

  // Count Chinese characters
  const chineseChars = (content.match(/[\u4e00-\u9fa5]/g) || []).length;

  // Count words (non-Chinese)
  const words = content
    .replace(/[\u4e00-\u9fa5]/g, '')
    .split(/\s+/)
    .filter((word) => word.length > 0).length;

  const readingTime = Math.ceil(chineseChars / chineseCharsPerMinute + words / wordsPerMinute);

  return Math.max(1, readingTime);
}

/**
 * Get all articles for static generation
 * Uses KV cache when available
 */
export async function getAllArticles(): Promise<FeedItem[]> {
  // Use KV cache if available
  if (isKVAvailable()) {
    return withKVCache<FeedItem[]>(
      CACHE_KEYS.ARTICLES,
      () => fetchAllArticlesInternal(),
      CACHE_TTL_SECONDS
    );
  }

  // Fallback: direct fetch without cache
  return fetchAllArticlesInternal();
}

/**
 * Internal function to fetch all articles from Notion
 */
async function fetchAllArticlesInternal(): Promise<FeedItem[]> {
  const allArticles: FeedItem[] = [];
  let hasMore = true;
  let nextCursor: string | null = null;

  while (hasMore) {
    const { articles, hasMore: more, nextCursor: cursor } = await fetchArticles({
      pageSize: 100,
      startCursor: nextCursor || undefined,
    });

    allArticles.push(...articles);
    hasMore = more;
    nextCursor = cursor;
  }

  return allArticles;
}

/**
 * Get all photos for static generation
 * Uses KV cache when available
 */
export async function getAllPhotos(): Promise<FeedItem[]> {
  // Use KV cache if available
  if (isKVAvailable()) {
    return withKVCache<FeedItem[]>(
      CACHE_KEYS.PHOTOS,
      () => fetchAllPhotosInternal(),
      CACHE_TTL_SECONDS
    );
  }

  // Fallback: direct fetch without cache
  return fetchAllPhotosInternal();
}

/**
 * Internal function to fetch all photos from Notion
 */
async function fetchAllPhotosInternal(): Promise<FeedItem[]> {
  const allPhotos: FeedItem[] = [];
  let hasMore = true;
  let nextCursor: string | null = null;

  while (hasMore) {
    const { photos, hasMore: more, nextCursor: cursor } = await fetchPhotos({
      pageSize: 100,
      startCursor: nextCursor || undefined,
    });

    allPhotos.push(...photos);
    hasMore = more;
    nextCursor = cursor;
  }

  return allPhotos;
}

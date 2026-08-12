/**
 * Bookmark link enrichment: fetches OG metadata for URLs found in Notion bookmark blocks.
 * Stores results in the link_metadata D1 table.
 */

import { getNotionClient } from '../../src/lib/api/notion/client';
import type { BookmarkMeta } from '../../src/lib/api/notion/blocks-to-html';

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

/**
 * Fetch OG metadata for a single URL.
 * Uses browser-like headers to improve compatibility with sites that block bots.
 * Has special handling for bilibili.com (uses API instead of scraping HTML).
 * Returns null on any failure — the caller falls back to domain + favicon.
 */
export async function fetchLinkMetadata(url: string): Promise<BookmarkMeta | null> {
  let domain = '';
  try {
    domain = new URL(url).hostname;
  } catch {
    domain = url;
  }

  // Special handling for bilibili — scrape HTML doesn't work from CF Workers
  if (domain.includes('bilibili.com')) {
    return await enrichBilibili(url, domain);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) return null;

  // Don't try to parse non-HTML responses
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
    return null;
  }

  let html: string;
  try {
    html = await response.text();
  } catch {
    return null;
  }

  // Only parse the first 500KB to avoid huge responses
  html = html.slice(0, 500_000);

  // If the HTML is too short, likely a bot-block page
  if (html.length < 200) return null;

  const meta: BookmarkMeta = { domain };

  // Extract OG tags and other meta tags
  const ogTitle = extractMetaContent(html, 'og:title');
  if (ogTitle) {
    meta.title = ogTitle;
  } else {
    const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (titleTag?.[1]) meta.title = decodeEntities(titleTag[1].trim());
  }

  const ogDesc = extractMetaContent(html, 'og:description');
  if (ogDesc) {
    meta.description = ogDesc;
  } else {
    const metaDesc = extractMetaContent(html, 'description', true);
    if (metaDesc) meta.description = metaDesc;
  }

  const ogImage = extractMetaContent(html, 'og:image');
  if (ogImage) {
    try {
      meta.image = new URL(ogImage, url).href;
    } catch {
      meta.image = ogImage;
    }
  }

  const iconLink = html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']*)["']/i)
    || html.match(/<link[^>]+href=["']([^"']*)["'][^>]+rel=["'](?:shortcut )?icon["']/i);
  if (iconLink?.[1]) {
    const raw = iconLink[1].trim();
    try {
      meta.favicon = new URL(raw, url).href;
    } catch {
      meta.favicon = raw;
    }
  } else {
    meta.favicon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
  }

  return meta;
}

/**
 * Special handling for bilibili.com URLs.
 * B站 blocks HTML scraping from CF Workers, but the API is accessible.
 */
async function enrichBilibili(url: string, domain: string): Promise<BookmarkMeta | null> {
  const meta: BookmarkMeta = {
    domain,
    favicon: 'https://www.bilibili.com/favicon.ico',
  };

  // Extract BV ID from URL
  const bvMatch = url.match(/\/video\/(BV[\w]+)/i);
  if (!bvMatch) {
    // Not a video URL (e.g. homepage), return minimal metadata
    meta.title = '哔哩哔哩 (゜-゜)つロ 干杯~-bilibili';
    meta.description = '哔哩哔哩（bilibili.com）是国内知名的视频弹幕网站，这里有及时的动漫新番，活跃的ACG氛围，有创意的Up主。大家可以在这里找到许多欢乐。';
    return meta;
  }

  const bvid = bvMatch[1];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(
      `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Referer': 'https://www.bilibili.com/',
        },
        signal: controller.signal,
      }
    );

    if (!response.ok) return meta;

    const json = await response.json() as any;

    if (json.code === 0 && json.data) {
      meta.title = json.data.title;
      meta.description = json.data.desc || json.data.title;
      // Upgrade http to https for cover image
      if (json.data.pic) {
        meta.image = (json.data.pic as string).replace(/^http:/, 'https:');
      }
    }
  } catch {
    // Return minimal metadata on failure
  } finally {
    clearTimeout(timer);
  }

  return meta;
}

/**
 * Extract meta tag content by property/name attribute.
 */
function extractMetaContent(html: string, key: string, useName = false): string | undefined {
  const attr = useName ? 'name' : 'property';
  const patterns = [
    new RegExp(`<meta[^>]+${attr}=["']${escapeRegex(key)}["'][^>]+content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+${attr}=["']${escapeRegex(key)}["']`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const text = match[1].trim();
      if (text) return decodeEntities(text);
    }
  }

  return undefined;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/**
 * Recursively walk Notion blocks and collect all bookmark URLs.
 */
async function collectBookmarkUrls(blockId: string): Promise<string[]> {
  const notion = getNotionClient();
  const urls: string[] = [];

  async function walk(id: string) {
    let cursor: string | undefined;
    do {
      const res = await notion.blocks.children.list({
        block_id: id,
        page_size: 100,
        start_cursor: cursor,
      });

      for (const block of res.results) {
        const b = block as any;
        if (b.type === 'bookmark' && b.bookmark?.url) {
          urls.push(b.bookmark.url);
        }
        if (b.has_children) {
          await walk(b.id);
        }
      }

      cursor = res.has_more ? (res.next_cursor || undefined) : undefined;
    } while (cursor);
  }

  await walk(blockId);
  return urls;
}

/**
 * For a given Notion page, ensure all bookmark URLs have metadata in D1.
 * Fetches OG metadata for any URLs not yet stored (or stored with null title).
 */
export async function ensureBookmarksEnriched(db: D1Database, pageId: string): Promise<void> {
  const urls = await collectBookmarkUrls(pageId);
  if (urls.length === 0) return;

  // Check which URLs already have non-null title in D1
  const placeholders = urls.map(() => '?').join(',');
  const existing = await db
    .prepare(`SELECT url, title FROM link_metadata WHERE url IN (${placeholders})`)
    .bind(...urls)
    .all();

  const knownWithTitle = new Set(
    existing.results
      .filter((r: any) => r.title !== null)
      .map((r: any) => r.url)
  );
  const newUrls = urls.filter((u) => !knownWithTitle.has(u));

  if (newUrls.length === 0) return;

  // Enrich new URLs in parallel (with concurrency limit)
  const CONCURRENCY = 3;
  const results: { url: string; meta: BookmarkMeta | null }[] = [];

  for (let i = 0; i < newUrls.length; i += CONCURRENCY) {
    const batch = newUrls.slice(i, i + CONCURRENCY);
    const metas = await Promise.allSettled(batch.map((url) => fetchLinkMetadata(url)));
    for (let j = 0; j < batch.length; j++) {
      const result = metas[j];
      const meta = result.status === 'fulfilled' ? result.value : null;
      results.push({ url: batch[j], meta });
    }
  }

  // Store results in D1 (even nulls as minimal records to avoid re-fetching)
  for (const { url, meta } of results) {
    await db
      .prepare(
        `INSERT INTO link_metadata (url, title, description, image, favicon, domain, fetched_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(url) DO UPDATE SET
           title = COALESCE(excluded.title, link_metadata.title),
           description = COALESCE(excluded.description, link_metadata.description),
           image = COALESCE(excluded.image, link_metadata.image),
           favicon = COALESCE(excluded.favicon, link_metadata.favicon),
           domain = COALESCE(excluded.domain, link_metadata.domain),
           fetched_at = datetime('now')`
      )
      .bind(
        url,
        meta?.title || null,
        meta?.description || null,
        meta?.image || null,
        meta?.favicon || null,
        meta?.domain || null
      )
      .run();
  }
}

/**
 * Create a resolveBookmarkMeta callback that reads from the link_metadata D1 table.
 */
export function createBookmarkResolver(db: D1Database) {
  return async (url: string): Promise<BookmarkMeta | null | undefined> => {
    const row = await db
      .prepare('SELECT title, description, image, favicon, domain FROM link_metadata WHERE url = ?')
      .bind(url)
      .first();

    if (!row) return null;

    const meta: BookmarkMeta = {
      title: (row as any).title || undefined,
      description: (row as any).description || undefined,
      image: (row as any).image || undefined,
      favicon: (row as any).favicon || undefined,
      domain: (row as any).domain || undefined,
    };

    return meta;
  };
}

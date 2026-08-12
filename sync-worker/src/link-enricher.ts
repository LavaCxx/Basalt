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
 * Uses a custom User-Agent to improve compatibility with sites that block Cloudflare IPs.
 * Returns null on any failure — the caller falls back to domain + favicon.
 */
export async function fetchLinkMetadata(url: string): Promise<BookmarkMeta | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
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

  // Only parse the first 200KB to avoid huge responses
  html = html.slice(0, 200_000);

  let domain = '';
  try {
    domain = new URL(url).hostname;
  } catch {
    domain = url;
  }

  const meta: BookmarkMeta = { domain };

  // Extract OG tags and other meta tags
  // og:title
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i);
  if (ogTitle?.[1]) {
    meta.title = ogTitle[1].trim();
  } else {
    const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (titleTag?.[1]) meta.title = titleTag[1].trim();
  }

  // og:description
  const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i);
  if (ogDesc?.[1]) {
    meta.description = ogDesc[1].trim();
  } else {
    const metaDesc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i);
    if (metaDesc?.[1]) meta.description = metaDesc[1].trim();
  }

  // og:image
  const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["']/i);
  if (ogImage?.[1]) {
    const raw = ogImage[1].trim();
    // Resolve relative URLs
    try {
      meta.image = new URL(raw, url).href;
    } catch {
      meta.image = raw;
    }
  }

  // favicon: look for <link rel="icon"> or <link rel="shortcut icon">
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
    // Fallback to Google favicon service
    meta.favicon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
  }

  return meta;
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
 * Fetches OG metadata for any URLs not yet stored.
 */
export async function ensureBookmarksEnriched(db: D1Database, pageId: string): Promise<void> {
  const urls = await collectBookmarkUrls(pageId);
  if (urls.length === 0) return;

  // Check which URLs are already in D1
  const placeholders = urls.map(() => '?').join(',');
  const existing = await db
    .prepare(`SELECT url FROM link_metadata WHERE url IN (${placeholders})`)
    .bind(...urls)
    .all();

  const knownUrls = new Set(existing.results.map((r: any) => r.url));
  const newUrls = urls.filter((u) => !knownUrls.has(u));

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

import { XMLParser } from 'fast-xml-parser';

export interface LatestFriendPost {
  title: string;
  url: string;
  publishedAt?: string;
}

const MAX_RSS_BYTES = 5 * 1024 * 1024;
const RSS_TIMEOUT_MS = 8000;

export async function fetchLatestFriendPost(feedUrl: string): Promise<LatestFriendPost | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RSS_TIMEOUT_MS);

  try {
    const response = await fetch(feedUrl, {
      signal: controller.signal,
      headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9' },
    });
    if (!response.ok) throw new Error(`RSS returned HTTP ${response.status}`);

    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > MAX_RSS_BYTES) throw new Error('RSS response exceeds 5 MB');

    const xml = await readBoundedText(response, MAX_RSS_BYTES);
    return parseLatestFriendPost(xml, feedUrl);
  } finally {
    clearTimeout(timeout);
  }
}

export function parseLatestFriendPost(xml: string, feedUrl: string): LatestFriendPost | null {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  let parsed: any;
  try {
    parsed = parser.parse(xml);
  } catch {
    throw new Error('RSS XML is invalid');
  }

  const rawEntries = parsed?.rss?.channel?.item ?? parsed?.feed?.entry ?? [];
  const entries = Array.isArray(rawEntries) ? rawEntries : rawEntries ? [rawEntries] : [];
  const posts = entries
    .map((entry: any) => normalizeEntry(entry, feedUrl))
    .filter((entry: LatestFriendPost | null): entry is LatestFriendPost => entry !== null);

  if (posts.length === 0) return null;
  const dated = posts.filter((post) => post.publishedAt && !Number.isNaN(Date.parse(post.publishedAt)));
  if (dated.length === 0) return posts[0];
  return dated.sort((a, b) => Date.parse(b.publishedAt!) - Date.parse(a.publishedAt!))[0];
}

function normalizeEntry(entry: any, feedUrl: string): LatestFriendPost | null {
  const title = textValue(entry.title).trim();
  const link = resolveEntryLink(entry.link, feedUrl);
  if (!title || !link) return null;

  const dateValue = textValue(entry.pubDate || entry.published || entry.updated || entry.date).trim();
  const date = dateValue && !Number.isNaN(Date.parse(dateValue))
    ? new Date(dateValue).toISOString()
    : undefined;
  return { title, url: link, publishedAt: date };
}

function resolveEntryLink(value: any, feedUrl: string): string | null {
  const candidates = Array.isArray(value) ? value : [value];
  for (const candidate of candidates) {
    const href = typeof candidate === 'string'
      ? candidate
      : candidate?.['@_href'] || candidate?.['#text'];
    const rel = typeof candidate === 'object' ? candidate?.['@_rel'] : undefined;
    if (!href || (rel && rel !== 'alternate')) continue;
    try {
      const resolved = new URL(String(href), feedUrl);
      if (resolved.protocol === 'http:' || resolved.protocol === 'https:') return resolved.toString();
    } catch {
      continue;
    }
  }
  return null;
}

function textValue(value: any): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return typeof value?.['#text'] === 'string' ? value['#text'] : '';
}

async function readBoundedText(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error('RSS response exceeds 5 MB');
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

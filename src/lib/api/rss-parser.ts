/**
 * Shared RSS parser using fast-xml-parser
 * Used by rss.ts (Douban) and telegram.ts (RSSHub)
 */

import { XMLParser } from 'fast-xml-parser';

export interface ParsedRSSItem {
  title: string;
  link: string;
  pubDate: string;
  isoDate: string | undefined;
  content: string;
  description: string;
  contentSnippet: string;
  guid: string;
}

export interface ParsedRSSFeed {
  items: ParsedRSSItem[];
  title?: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseAttributeValue: false,
});

/**
 * Fetch and parse an RSS feed
 */
export async function fetchAndParseRSS(
  url: string,
  options?: { headers?: Record<string, string> }
): Promise<ParsedRSSFeed> {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'application/rss+xml, application/xml, text/xml, */*',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const xmlText = await response.text();
  const parsed = parser.parse(xmlText);

  const channel = parsed.rss?.channel || parsed.channel;
  const title = channel?.title;
  const rawItems = channel?.item || [];

  const items: ParsedRSSItem[] = (Array.isArray(rawItems) ? rawItems : [rawItems]).map(
    (item: any) => ({
      title: item.title,
      link: item.link,
      pubDate: item.pubDate,
      isoDate: item.pubDate ? new Date(item.pubDate).toISOString() : undefined,
      content: item['content:encoded'] || item.description || item.content,
      description: item.description,
      contentSnippet:
        typeof item.description === 'string'
          ? item.description.replace(/<[^>]+>/g, '').trim()
          : '',
      guid: item.guid?.['#text'] || item.guid || item.link,
    })
  );

  return { items, title };
}

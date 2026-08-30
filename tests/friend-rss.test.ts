import { describe, expect, it } from 'vitest';
import { parseLatestFriendPost } from '../sync-worker/src/friend-rss';
import { shouldRefreshFriendRss } from '../sync-worker/src/sync';

describe('friend RSS parser', () => {
  it('selects the newest RSS 2.0 item by date', () => {
    const xml = `<?xml version="1.0"?><rss><channel>
      <item><title>旧文章</title><link>https://example.com/old</link><pubDate>Fri, 01 Aug 2025 00:00:00 GMT</pubDate></item>
      <item><title>新文章</title><link>https://example.com/new</link><pubDate>Fri, 01 Aug 2026 00:00:00 GMT</pubDate></item>
    </channel></rss>`;
    expect(parseLatestFriendPost(xml, 'https://example.com/rss.xml')?.title).toBe('新文章');
  });

  it('supports Atom links and relative URLs', () => {
    const xml = `<?xml version="1.0"?><feed>
      <entry><title>Atom 文章</title><link rel="alternate" href="/posts/1"/><updated>2026-08-01T00:00:00Z</updated></entry>
    </feed>`;
    expect(parseLatestFriendPost(xml, 'https://example.com/feed.xml')).toEqual({
      title: 'Atom 文章',
      url: 'https://example.com/posts/1',
      publishedAt: '2026-08-01T00:00:00.000Z',
    });
  });

  it('uses the first item when dates are unavailable and returns null for empty feeds', () => {
    const xml = `<rss><channel><item><title>第一篇</title><link>https://example.com/1</link></item><item><title>第二篇</title><link>https://example.com/2</link></item></channel></rss>`;
    expect(parseLatestFriendPost(xml, 'https://example.com/rss.xml')?.title).toBe('第一篇');
    expect(parseLatestFriendPost('<rss><channel></channel></rss>', 'https://example.com/rss.xml')).toBeNull();
  });
});

describe('friend RSS refresh policy', () => {
  const now = Date.parse('2026-08-30T12:00:00Z');

  it('refreshes missing and stale checks but not recent checks', () => {
    expect(shouldRefreshFriendRss(null, now)).toBe(true);
    expect(shouldRefreshFriendRss('2026-08-30T05:59:59Z', now)).toBe(true);
    expect(shouldRefreshFriendRss('2026-08-30T06:01:00Z', now)).toBe(false);
    expect(shouldRefreshFriendRss('2026-08-30T11:29:59Z', now, true)).toBe(true);
    expect(shouldRefreshFriendRss('2026-08-30T11:31:00Z', now, true)).toBe(false);
  });
});

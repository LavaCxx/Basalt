import type { APIRoute } from 'astro';
import { getFeedItems, initRuntime } from '../lib/api';

export const prerender = false;

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim()
    .slice(0, 300);
}

export const GET: APIRoute = async (context) => {
  const runtimeEnv = (context as any).runtime?.env || (context.locals as any)?.runtime?.env;
  if (runtimeEnv) {
    initRuntime(runtimeEnv);
  }

  const site = context.site?.toString() || 'https://basalt.pages.dev';

  let items: any[] = [];
  try {
    items = await getFeedItems();
  } catch {
    items = [];
  }

  const feedItems = items.slice(0, 20);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>LavaC</title>
    <link>${escapeXml(site)}</link>
    <description>个人博客与内容聚合</description>
    <language>zh-CN</language>
    <atom:link href="${escapeXml(site)}/rss.xml" rel="self" type="application/rss+xml" />
${feedItems
  .map((item) => {
    const itemUrl = item.url
      ? item.url.startsWith('http')
        ? item.url
        : `${site}${item.url}`
      : `${site}/`;
    const description = item.content
      ? escapeXml(stripHtml(item.content))
      : escapeXml(item.title || '');
    const title = item.title || '无标题';
    const pubDate = item.date instanceof Date ? item.date.toUTCString() : new Date(item.date).toUTCString();

    let xml = `    <item>\n`;
    xml += `      <title>${escapeXml(title)}</title>\n`;
    xml += `      <link>${escapeXml(itemUrl)}</link>\n`;
    xml += `      <guid isPermaLink="false">${escapeXml(item.id)}</guid>\n`;
    xml += `      <pubDate>${pubDate}</pubDate>\n`;
    xml += `      <description>${description}</description>\n`;
    if (item.image) {
      xml += `      <enclosure url="${escapeXml(item.image)}" type="image/jpeg" length="0" />\n`;
    }
    xml += `    </item>`;
    return xml;
  })
  .join('\n')}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'max-age=600',
    },
  });
};

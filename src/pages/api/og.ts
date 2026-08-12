/**
 * Open Graph metadata endpoint
 * Fetches og:title / <title> and og:description / meta description from a URL
 * Usage: /api/og?url=https://example.com
 */

export const prerender = false;

export async function GET({ url }: { url: URL }) {
  const target = url.searchParams.get('url');
  if (!target) {
    return Response.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return Response.json({ error: 'Invalid url' }, { status: 400 });
  }

  if (!/^https?:$/.test(parsed.protocol)) {
    return Response.json({ error: 'Only http/https allowed' }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html',
      },
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      return Response.json({ title: '', description: '' });
    }

    const html = await resp.text();
    const head = html.substring(0, 50000);

    let title = '';
    let description = '';

    const ogTitle = head.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i);
    const titleTag = head.match(/<title[^>]*>([^<]*)<\/title>/i);
    title = (ogTitle?.[1] || titleTag?.[1] || '').trim();

    const ogDesc = head.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i);
    const metaDesc = head.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
    description = (ogDesc?.[1] || metaDesc?.[1] || '').trim();

    // Also handle content-before-property/name order
    if (!title) {
      const ogTitleAlt = head.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:title["']/i);
      title = (ogTitleAlt?.[1] || '').trim();
    }
    if (!description) {
      const metaDescAlt = head.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
      description = (metaDescAlt?.[1] || '').trim();
    }

    return Response.json({
      title: title.substring(0, 200),
      description: description.substring(0, 300),
    }, {
      headers: { 'Cache-Control': 'public, max-age=86400' },
    });
  } catch {
    return Response.json({ title: '', description: '' });
  }
}

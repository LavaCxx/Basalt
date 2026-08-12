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

  const debug = url.searchParams.get('debug') === '1';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
      },
      redirect: 'follow',
    });
    clearTimeout(timeout);

    const contentType = resp.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return Response.json({ title: '', description: '' }, {
        headers: { 'Cache-Control': 'public, max-age=86400' },
      });
    }

    const html = await resp.text();
    const head = html.substring(0, 80000);

    let title = '';
    let description = '';

    // og:title — handles both property-first and content-first attribute orders
    const ogTitle = head.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i)
      || head.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:title["']/i);
    const titleTag = head.match(/<title[^>]*>([^<]*)<\/title>/i);
    title = (ogTitle?.[1] || titleTag?.[1] || '').trim();

    // og:description
    const ogDesc = head.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i)
      || head.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:description["']/i);
    const metaDesc = head.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
      || head.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
    description = (ogDesc?.[1] || metaDesc?.[1] || '').trim();

    if (debug) {
      return Response.json({
        title: title.substring(0, 200),
        description: description.substring(0, 300),
        debug: {
          status: resp.status,
          contentType,
          htmlLength: html.length,
          headSample: html.substring(0, 800),
          hasTitleTag: !!titleTag,
          hasOgTitle: !!ogTitle,
          hasMetaDesc: !!metaDesc,
        },
      });
    }

    return Response.json({
      title: title.substring(0, 200),
      description: description.substring(0, 300),
    }, {
      headers: { 'Cache-Control': 'public, max-age=86400' },
    });
  } catch (e) {
    if (debug) {
      return Response.json({ title: '', description: '', debug: { error: String(e) } });
    }
    return Response.json({ title: '', description: '' });
  }
}

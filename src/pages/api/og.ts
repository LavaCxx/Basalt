/**
 * Open Graph metadata endpoint
 * Fetches og:title / <title> and og:description / meta description from a URL
 * Usage: /api/og?url=https://example.com
 * 
 * Strategy: try direct fetch first, fall back to microlink.io API
 */

export const prerender = false;

interface OgResult {
  title: string;
  description: string;
}

/** Extract title/description from raw HTML */
function parseHtmlMeta(html: string): OgResult {
  const head = html.substring(0, 80000);
  let title = '';
  let description = '';

  const ogTitle = head.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i)
    || head.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:title["']/i);
  const titleTag = head.match(/<title[^>]*>([^<]*)<\/title>/i);
  title = (ogTitle?.[1] || titleTag?.[1] || '').trim();

  const ogDesc = head.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i)
    || head.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:description["']/i);
  const metaDesc = head.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
    || head.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
  description = (ogDesc?.[1] || metaDesc?.[1] || '').trim();

  return { title: title.substring(0, 200), description: description.substring(0, 300) };
}

/** Strategy 1: direct fetch with browser UA */
async function fetchDirect(targetUrl: string): Promise<OgResult | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const resp = await fetch(targetUrl, {
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
      return null;
    }

    const html = await resp.text();
    const result = parseHtmlMeta(html);

    // Sanity check: if title looks like an error page, treat as failure
    if (result.title && /出错|error|403|404|access denied|forbidden|验证/i.test(result.title)) {
      return null;
    }

    return result.title || result.description ? result : null;
  } catch {
    return null;
  }
}

/** Strategy 2: microlink.io API (handles anti-bot, different IP pools) */
async function fetchMicrolink(targetUrl: string): Promise<OgResult | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(targetUrl)}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) return null;
    const data = await resp.json();
    if (data.status !== 'success') return null;

    const title = (data.data?.title || '').trim();
    const description = (data.data?.description || '').trim();

    return title || description ? { title: title.substring(0, 200), description: description.substring(0, 300) } : null;
  } catch {
    return null;
  }
}

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

  // Try direct fetch first, then microlink fallback
  const result = await fetchDirect(parsed.toString()) || await fetchMicrolink(parsed.toString());

  return Response.json(result || { title: '', description: '' }, {
    headers: { 'Cache-Control': 'public, max-age=86400' },
  });
}

import type { APIRoute } from 'astro';

export const prerender = false;

const imageContentTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]);

export const GET: APIRoute = async (context) => {
  const runtimeEnv = (context as any).runtime?.env || (context.locals as any)?.runtime?.env;
  const friendId = context.url.searchParams.get('id') || '';

  if (!/^[0-9a-f-]{32,36}$/i.test(friendId)) return invalidRequest('Invalid friend reference');
  if (!runtimeEnv?.DB) return unavailable('Database binding is unavailable');

  try {
    const friend = await runtimeEnv.DB
      .prepare('SELECT icon_url FROM friends WHERE id = ? LIMIT 1')
      .bind(friendId)
      .first();
    if (!friend?.icon_url) return notFound();

    const sourceUrl = new URL(friend.icon_url);
    if (!['http:', 'https:'].includes(sourceUrl.protocol)) return invalidRequest('Unsupported icon URL');

    const imageResponse = await fetch(sourceUrl.href, {
      headers: {
        Accept: 'image/avif,image/webp,image/svg+xml,image/*;q=0.8',
        'User-Agent': 'LavaC-Blog-Friend-Icon/1.0',
      },
    });
    const contentType = (imageResponse.headers.get('content-type') || '').split(';', 1)[0].toLowerCase();
    const contentLength = Number(imageResponse.headers.get('content-length') || 0);

    if (!imageResponse.ok || !imageContentTypes.has(contentType)) return unavailable('Icon is not available');
    if (contentLength > 2 * 1024 * 1024) return unavailable('Icon is too large');

    return new Response(imageResponse.body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Friend icon proxy error:', error);
    return unavailable('Icon is not available');
  }
};

function invalidRequest(message: string): Response {
  return new Response(message, { status: 400, headers: { 'Cache-Control': 'no-store' } });
}

function notFound(): Response {
  return new Response('Friend icon not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
}

function unavailable(message: string): Response {
  return new Response(message, { status: 502, headers: { 'Cache-Control': 'no-store' } });
}

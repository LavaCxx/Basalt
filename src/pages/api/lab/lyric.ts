import type { APIRoute } from 'astro';

export const prerender = false;

const DEFAULT_METING_API = 'https://163.hyc.moe/';
const MAX_LYRIC_BYTES = 128_000;
const REQUEST_TIMEOUT_MS = 8_000;

export const GET: APIRoute = async (context) => {
  const id = context.url.searchParams.get('id') || '';
  if (!/^\d{1,20}$/.test(id)) return json({ error: 'Invalid lyric request' }, 400, 'no-store');

  const runtimeEnv = (context as any).runtime?.env || (context.locals as any)?.runtime?.env;
  const configuredBase = runtimeEnv?.METING_API_BASE || import.meta.env.METING_API_BASE;

  let endpoint: URL;
  try {
    endpoint = new URL(configuredBase || DEFAULT_METING_API);
    if (endpoint.protocol !== 'https:') throw new Error('Meting API must use HTTPS');
  } catch {
    return json({ error: 'Music service is not configured correctly' }, 500, 'no-store');
  }

  endpoint.searchParams.set('server', 'netease');
  endpoint.searchParams.set('type', 'lrc');
  endpoint.searchParams.set('id', id);
  endpoint.searchParams.set('format', 'lrc');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const upstream = await fetch(endpoint, {
      headers: { Accept: 'text/plain' },
      signal: controller.signal,
    });
    if (!upstream.ok) return json({ error: 'Lyrics are temporarily unavailable' }, 502, 'no-store');

    const lyric = (await readTextWithinLimit(upstream, MAX_LYRIC_BYTES)).replaceAll('\0', '').trim();
    if (!lyric) return json({ lyric: '' }, 200, 'public, max-age=300, s-maxage=3600');

    return json(
      { lyric: lyric.slice(0, 100_000) },
      200,
      'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800',
    );
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError'
      ? 'Lyrics request timed out'
      : 'Lyrics could not be reached';
    console.error('Meting lyric API error:', error);
    return json({ error: message }, 502, 'no-store');
  } finally {
    clearTimeout(timeout);
  }
};

async function readTextWithinLimit(response: Response, limit: number): Promise<string> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > limit) throw new Error('Lyric response is too large');
  if (!response.body) throw new Error('Lyric response has no body');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let result = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > limit) {
      await reader.cancel();
      throw new Error('Lyric response is too large');
    }
    result += decoder.decode(value, { stream: true });
  }
  return result + decoder.decode();
}

function json(body: unknown, status: number, cacheControl: string): Response {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': cacheControl,
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

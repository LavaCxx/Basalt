import type { APIRoute } from 'astro';

export const prerender = false;

const DEFAULT_METING_API = 'https://163.hyc.moe/';
const MAX_RESPONSE_BYTES = 1_000_000;
const REQUEST_TIMEOUT_MS = 8_000;
const allowedTypes = new Set(['playlist', 'album', 'song']);

interface MetingTrack {
  name?: unknown;
  artist?: unknown;
  album?: unknown;
  source?: unknown;
  url?: unknown;
  pic?: unknown;
  cover?: unknown;
  lrc?: unknown;
}

export const GET: APIRoute = async (context) => {
  const type = context.url.searchParams.get('type') || 'playlist';
  const id = context.url.searchParams.get('id') || '';

  if (!allowedTypes.has(type) || !/^\d{1,20}$/.test(id)) {
    return json({ error: 'Invalid music request' }, 400, 'no-store');
  }

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
  endpoint.searchParams.set('type', type);
  endpoint.searchParams.set('id', id);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const upstream = await fetch(endpoint, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!upstream.ok) {
      return json({ error: 'Music service is temporarily unavailable' }, 502, 'no-store');
    }

    const payload = await readJsonWithinLimit(upstream, MAX_RESPONSE_BYTES);
    if (!Array.isArray(payload)) {
      return json({ error: 'Music service returned an unexpected response' }, 502, 'no-store');
    }

    const tracks = payload
      .slice(0, 200)
      .map((track, index) => normalizeTrack(track as MetingTrack, index))
      .filter((track) => track !== null);

    if (!tracks.length) {
      return json({ error: 'No playable tracks were found' }, 404, 'no-store');
    }

    return json(
      { source: 'netease', tracks },
      200,
      'public, max-age=300, s-maxage=21600, stale-while-revalidate=86400',
    );
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError'
      ? 'Music service timed out'
      : 'Music service could not be reached';
    console.error('Meting API error:', error);
    return json({ error: message }, 502, 'no-store');
  } finally {
    clearTimeout(timeout);
  }
};

function normalizeTrack(track: MetingTrack, index: number) {
  const name = cleanText(track.name);
  const artist = cleanText(track.artist);
  const url = safeHttpsUrl(track.url);
  if (!name || !artist || !url) return null;

  return {
    id: extractMetingId(url) || `${index + 1}`,
    name,
    artist,
    album: cleanText(track.album) || '网易云音乐',
    url,
    cover: safeHttpsUrl(track.pic ?? track.cover),
    lyric: safeHttpsUrl(track.lrc),
  };
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 300) : '';
}

function safeHttpsUrl(value: unknown): string {
  if (typeof value !== 'string' || !value) return '';
  try {
    const url = new URL(value);
    if (url.protocol === 'http:') url.protocol = 'https:';
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function extractMetingId(value: string): string {
  try {
    return new URL(value).searchParams.get('id') || '';
  } catch {
    return '';
  }
}

async function readJsonWithinLimit(response: Response, limit: number): Promise<unknown> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > limit) {
    throw new Error('Meting response is too large');
  }

  if (!response.body) throw new Error('Meting response has no body');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > limit) {
      await reader.cancel();
      throw new Error('Meting response is too large');
    }
    chunks.push(value);
  }

  const combined = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(combined));
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

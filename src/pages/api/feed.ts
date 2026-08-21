import type { APIRoute } from 'astro';
import { getFeedItems, getFeedPage, initRuntime } from '../../lib/api';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  try {
    const runtimeEnv = (context as any).runtime?.env || (context.locals as any)?.runtime?.env;
    if (runtimeEnv) {
      initRuntime(runtimeEnv);
    }

    const limitParam = context.url.searchParams.get('limit');
    const cursor = context.url.searchParams.get('cursor') || undefined;
    const limit = limitParam ? Number(limitParam) : undefined;
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 100)) {
      return jsonResponse({ error: 'limit must be an integer between 1 and 100' }, 400);
    }

    // Preserve the legacy array response when pagination is not requested.
    const result = limit
      ? await getFeedPage({ limit, cursor })
      : await getFeedItems();
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (error) {
    console.error('Feed API error:', error);
    const status = error instanceof Error && error.message === 'Invalid feed cursor' ? 400 : 500;
    return jsonResponse({ error: status === 400 ? 'Invalid cursor' : 'Failed to fetch feed' }, status);
  }
};

const jsonHeaders = {
  'Content-Type': 'application/json',
  'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

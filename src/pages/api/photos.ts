import type { APIRoute } from 'astro';
import { getAllPhotos } from '../../lib/api/notion';
import { setRuntimeEnvAndClearCache } from '../../lib/api';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  try {
    const runtimeEnv = (context as any).runtime?.env || (context.locals as any)?.runtime?.env;
    if (runtimeEnv) {
      setRuntimeEnvAndClearCache(runtimeEnv);
    }

    const photos = await getAllPhotos();
    return new Response(JSON.stringify(photos), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Photos API error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch photos' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

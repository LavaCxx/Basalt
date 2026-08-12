import type { APIRoute } from 'astro';
import { getPhotosByYear, initRuntime } from '../../lib/api';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  try {
    const runtimeEnv = (context as any).runtime?.env || (context.locals as any)?.runtime?.env;
    if (runtimeEnv) {
      initRuntime(runtimeEnv);
    }

    const photoGroups = await getPhotosByYear();
    // Flatten for backwards-compatible API response
    const allPhotos = Object.values(photoGroups).flat();
    return new Response(JSON.stringify(allPhotos), {
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

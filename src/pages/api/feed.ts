import type { APIRoute } from 'astro';
import { getFeedItems, setRuntimeEnvAndClearCache } from '../../lib/api';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  try {
    const runtimeEnv = (context as any).runtime?.env || (context.locals as any)?.runtime?.env;
    if (runtimeEnv) {
      setRuntimeEnvAndClearCache(runtimeEnv);
    }

    const items = await getFeedItems();
    return new Response(JSON.stringify(items), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Feed API error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch feed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

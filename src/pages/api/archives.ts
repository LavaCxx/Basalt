import type { APIRoute } from 'astro';
import { getArchiveItems, initRuntime } from '../../lib/api';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  try {
    const runtimeEnv = (context as any).runtime?.env || (context.locals as any)?.runtime?.env;
    if (runtimeEnv) {
      initRuntime(runtimeEnv);
    }

    const items = await getArchiveItems();
    return new Response(JSON.stringify(items), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Archives API error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch archives' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};

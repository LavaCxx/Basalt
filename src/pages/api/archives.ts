import type { APIRoute } from 'astro';
import { getArchiveItems, setRuntimeEnvAndClearCache } from '../../lib/api';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  try {
    // Pass Cloudflare runtime env to the API module
    const runtimeEnv = (context as any).runtime?.env || (context.locals as any)?.runtime?.env;
    if (runtimeEnv) {
      setRuntimeEnvAndClearCache(runtimeEnv);
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

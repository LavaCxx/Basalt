import type { APIRoute } from 'astro';
import { setRuntimeEnvAndClearCache } from '../../lib/api';
import { setRuntimeKVEnv, kvDelete, isKVAvailable } from '../../lib/kv-cache';

export const prerender = false;

/**
 * Clear KV cache for Notion data
 * Useful when you want to force refresh data from Notion API
 */
export const GET: APIRoute = async (context) => {
  const runtimeEnv = (context as any).runtime?.env || (context.locals as any)?.runtime?.env;
  if (runtimeEnv) {
    setRuntimeEnvAndClearCache(runtimeEnv);
    setRuntimeKVEnv(runtimeEnv);
  }

  if (!isKVAvailable()) {
    return new Response(JSON.stringify({ error: 'KV not available' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const keys = [
    'notion:articles:all',
    'notion:photos:all',
  ];

  const results: string[] = [];
  for (const key of keys) {
    await kvDelete(key);
    results.push(`Cleared: ${key}`);
  }

  return new Response(JSON.stringify({
    success: true,
    cleared: results,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

/**
 * Cache clear / sync trigger endpoint.
 *
 * Previously this cleared KV cache entries. Now that data lives in D1 and is
 * synced by the sync worker, this endpoint serves as an optional manual sync
 * trigger — it sends a request to the sync worker's HTTP endpoint.
 *
 * Set the SYNC_WORKER_URL environment variable (e.g. https://basalt-sync.YOUR-SUBDOMAIN.workers.dev)
 * and optionally SYNC_WORKER_TOKEN for a shared secret.
 */

import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const runtimeEnv = (context as any).runtime?.env || (context.locals as any)?.runtime?.env;
  const syncWorkerUrl = runtimeEnv?.SYNC_WORKER_URL;
  const syncWorkerToken = runtimeEnv?.SYNC_WORKER_TOKEN;

  if (!syncWorkerUrl) {
    return new Response(
      JSON.stringify({ error: 'SYNC_WORKER_URL is not configured. Set it to your sync worker URL.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const headers: Record<string, string> = {};
    if (syncWorkerToken) {
      headers['Authorization'] = `Bearer ${syncWorkerToken}`;
    }

    const response = await fetch(syncWorkerUrl, { headers });
    const result = await response.text();

    return new Response(result, {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Sync trigger error:', error);
    return new Response(
      JSON.stringify({ error: `Failed to trigger sync: ${String(error)}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

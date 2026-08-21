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
import { verifyBearerToken } from '../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const runtimeEnv = (context as any).runtime?.env || (context.locals as any)?.runtime?.env;
  const syncWorkerUrl = runtimeEnv?.SYNC_WORKER_URL;
  const syncWorkerToken = runtimeEnv?.SYNC_WORKER_TOKEN;
  const adminSyncToken = runtimeEnv?.ADMIN_SYNC_TOKEN;

  if (!(await verifyBearerToken(context.request, adminSyncToken))) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  if (!syncWorkerUrl || !syncWorkerToken) {
    return jsonResponse({ error: 'Manual sync is not configured' }, 503);
  }

  try {
    const target = new URL('/sync', syncWorkerUrl);
    const response = await fetch(target, {
      method: 'POST',
      headers: { Authorization: `Bearer ${syncWorkerToken}` },
    });
    const result = await response.text();

    return new Response(result, {
      status: response.status,
      headers: jsonHeaders,
    });
  } catch (error) {
    console.error('Sync trigger error:', error);
    return jsonResponse({ error: 'Failed to trigger sync' }, 502);
  }
};

const jsonHeaders = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

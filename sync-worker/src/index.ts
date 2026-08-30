/**
 * Basalt Sync Worker
 *
 * Cloudflare Worker with a Cron Trigger that periodically syncs data from
 * Notion, Telegram (RSSHub), and Douban (RSS) into the D1 database.
 *
 * The blog (Astro on Cloudflare Pages) reads exclusively from D1 — it never
 * contacts the third-party sources directly.
 */

import { setRuntimeEnv } from '../../src/lib/api/env';
import { verifyBearerToken } from '../../src/lib/auth';
import { syncNotionArticles, syncNotionPhotos, syncTelegram, syncDouban, syncNotionCurrent, syncNotionFriends, syncSteam } from './sync';
import { releaseSyncLock, tryAcquireSyncLock, type D1Database } from './db';

export interface Env {
  DB: D1Database;
  // Notion
  NOTION_API_KEY: string;
  NOTION_ARTICLES_DATABASE_ID: string;
  NOTION_PHOTOS_DATABASE_ID: string;
  NOTION_CURRENT_DATABASE_ID?: string;
  NOTION_FRIENDS_DATABASE_ID?: string;
  // Telegram (RSSHub)
  TELEGRAM_CHANNEL_USERNAME?: string;
  RSSHUB_INSTANCE?: string;
  // Douban
  DOUBAN_USER_RSS?: string;
  STEAM_ID?: string;
  STEAM_API_KEY?: string;
  SYNC_WORKER_TOKEN?: string;
}

/**
 * Convert Cloudflare env bindings into a plain string record for setRuntimeEnv.
 */
function envToStringRecord(env: Env): Record<string, string> {
  const record: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string') {
      record[key] = value;
    }
  }
  return record;
}

async function runSync(env: Env): Promise<Record<string, 'ok' | 'error'>> {
  const envRecord = envToStringRecord(env);
  setRuntimeEnv(envRecord);

  const results: Record<string, 'ok' | 'error'> = {};
  const sources: { name: string; fn: () => Promise<void> }[] = [
    { name: 'notion:articles', fn: () => syncNotionArticles(env.DB, envRecord) },
    { name: 'notion:photos', fn: () => syncNotionPhotos(env.DB, envRecord) },
  ];

  if (env.NOTION_CURRENT_DATABASE_ID) {
    sources.push({ name: 'notion:current', fn: () => syncNotionCurrent(env.DB, envRecord) });
  }
  if (env.NOTION_FRIENDS_DATABASE_ID) {
    sources.push({ name: 'notion:friends', fn: () => syncNotionFriends(env.DB, envRecord) });
  }
  if (env.TELEGRAM_CHANNEL_USERNAME) {
    sources.push({ name: 'telegram', fn: () => syncTelegram(env.DB, envRecord) });
  }
  if (env.DOUBAN_USER_RSS) {
    sources.push({ name: 'douban', fn: () => syncDouban(env.DB, envRecord) });
  }
  if (env.STEAM_ID && env.STEAM_API_KEY) {
    sources.push({ name: 'steam', fn: () => syncSteam(env.DB, envRecord) });
  }

  await Promise.allSettled(
    sources.map(async (source) => {
      try {
        await source.fn();
        results[source.name] = 'ok';
        console.log(JSON.stringify({ event: 'sync.complete', source: source.name }));
      } catch (error) {
        results[source.name] = 'error';
        console.error(JSON.stringify({
          event: 'sync.failed',
          source: source.name,
          error: error instanceof Error ? error.message : String(error),
        }));
      }
    })
  );

  return results;
}

export default {
  /**
   * Scheduled handler — triggered by Cron Trigger.
   */
  async scheduled(_controller: unknown, env: Env): Promise<void> {
    if (!(await tryAcquireSyncLock(env.DB))) {
      console.log(JSON.stringify({ event: 'sync.skipped', reason: 'already_running', trigger: 'cron' }));
      return;
    }

    try {
      const results = await runSync(env);
      console.log('[sync] Summary:', JSON.stringify(results));
    } finally {
      await releaseSyncLock(env.DB);
    }
  },

  /**
   * Fetch handler — allows manual sync trigger via HTTP for testing.
   * POST /sync → triggers a full sync and returns the summary.
   */
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/health' && request.method === 'GET') {
      return new Response(JSON.stringify({ status: 'ok', time: new Date().toISOString() }), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    }

    if (url.pathname !== '/sync') {
      return new Response('Not found', { status: 404 });
    }
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
    }
    if (!(await verifyBearerToken(request, env.SYNC_WORKER_TOKEN))) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    }

    if (!(await tryAcquireSyncLock(env.DB))) {
      return new Response(JSON.stringify({ error: 'Sync already in progress' }), {
        status: 409,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'Retry-After': '30',
        },
      });
    }

    try {
      const results = await runSync(env);
      return new Response(JSON.stringify({ sync: results, time: new Date().toISOString() }, null, 2), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    } finally {
      await releaseSyncLock(env.DB);
    }
  },
};

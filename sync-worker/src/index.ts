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
import { syncNotionArticles, syncNotionPhotos, syncTelegram, syncDouban } from './sync';

export interface Env {
  DB: D1Database;
  // Notion
  NOTION_API_KEY: string;
  NOTION_ARTICLES_DATABASE_ID: string;
  NOTION_PHOTOS_DATABASE_ID: string;
  // Telegram (RSSHub)
  TELEGRAM_CHANNEL_USERNAME?: string;
  RSSHUB_INSTANCE?: string;
  // Douban
  DOUBAN_USER_RSS?: string;
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

export default {
  /**
   * Scheduled handler — triggered by Cron Trigger.
   */
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const envRecord = envToStringRecord(env);
    setRuntimeEnv(envRecord);

    const results: Record<string, string> = {};

    // Sync each source independently — one failure doesn't block the others
    const sources: { name: string; fn: () => Promise<void> }[] = [
      { name: 'notion:articles', fn: () => syncNotionArticles(env.DB, envRecord) },
      { name: 'notion:photos', fn: () => syncNotionPhotos(env.DB, envRecord) },
    ];

    if (env.TELEGRAM_CHANNEL_USERNAME) {
      sources.push({ name: 'telegram', fn: () => syncTelegram(env.DB, envRecord) });
    }
    if (env.DOUBAN_USER_RSS) {
      sources.push({ name: 'douban', fn: () => syncDouban(env.DB, envRecord) });
    }

    // Run all syncs in parallel (they write to different item types)
    await Promise.allSettled(
      sources.map(async (source) => {
        try {
          await source.fn();
          results[source.name] = 'ok';
          console.log(`[sync] ${source.name}: success`);
        } catch (error) {
          results[source.name] = `error: ${String(error)}`;
          console.error(`[sync] ${source.name} failed:`, error);
        }
      })
    );

    console.log('[sync] Summary:', JSON.stringify(results));
  },

  /**
   * Fetch handler — allows manual sync trigger via HTTP for testing.
   * GET / → triggers a full sync and returns the summary.
   * Protect this in production with a secret header if needed.
   */
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', time: new Date().toISOString() }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Manual sync trigger
    const envRecord = envToStringRecord(env);
    setRuntimeEnv(envRecord);

    const results: Record<string, string> = {};
    const sources: { name: string; fn: () => Promise<void> }[] = [
      { name: 'notion:articles', fn: () => syncNotionArticles(env.DB, envRecord) },
      { name: 'notion:photos', fn: () => syncNotionPhotos(env.DB, envRecord) },
    ];

    if (env.TELEGRAM_CHANNEL_USERNAME) {
      sources.push({ name: 'telegram', fn: () => syncTelegram(env.DB, envRecord) });
    }
    if (env.DOUBAN_USER_RSS) {
      sources.push({ name: 'douban', fn: () => syncDouban(env.DB, envRecord) });
    }

    await Promise.allSettled(
      sources.map(async (source) => {
        try {
          await source.fn();
          results[source.name] = 'ok';
        } catch (error) {
          results[source.name] = `error: ${String(error)}`;
          console.error(`[sync] ${source.name} failed:`, error);
        }
      })
    );

    return new Response(JSON.stringify({ sync: results, time: new Date().toISOString() }, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};

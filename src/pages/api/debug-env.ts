import type { APIRoute } from 'astro';
import { setRuntimeEnvAndClearCache, getFeedItems } from '../../lib/api';
import { getNotionClient, getArticlesDatabaseId } from '../../lib/api/notion/client';
import { fetchArticles, getAllArticles } from '../../lib/api/notion/articles';
import { kvDelete, isKVAvailable } from '../../lib/kv-cache';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const runtimeEnv = (context as any).runtime?.env || (context.locals as any)?.runtime?.env;
  if (runtimeEnv) setRuntimeEnvAndClearCache(runtimeEnv);

  const result: any = {};

  // Clear KV cache
  await kvDelete('notion:articles:all');
  await kvDelete('notion:photos:all');

  // Try fetchArticles directly (single page)
  try {
    const { articles, hasMore, nextCursor } = await fetchArticles({ pageSize: 100 });
    result.fetchArticlesCount = articles.length;
    result.fetchArticlesSample = articles.map((a: any) => ({ id: a.id, title: a.title, type: a.type }));
  } catch (e: any) {
    result.fetchArticlesError = e?.message || String(e);
  }

  // Try getAllArticles
  try {
    const all = await getAllArticles();
    result.getAllArticlesCount = all.length;
  } catch (e: any) {
    result.getAllArticlesError = e?.message || String(e);
  }

  // Try getFeedItems
  try {
    const feed = await getFeedItems();
    result.feedCount = feed.length;
    result.feedTypes = feed.map((f: any) => f.type);
  } catch (e: any) {
    result.feedError = e?.message || String(e);
  }

  return new Response(JSON.stringify(result, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

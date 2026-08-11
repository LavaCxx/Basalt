import type { APIRoute } from 'astro';
import { setRuntimeEnvAndClearCache, getFeedItems } from '../../lib/api';
import { getAllArticles } from '../../lib/api/notion';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const runtimeEnv = (context as any).runtime?.env || (context.locals as any)?.runtime?.env;
  if (runtimeEnv) setRuntimeEnvAndClearCache(runtimeEnv);

  const articles = await getAllArticles();
  const feed = await getFeedItems();

  return new Response(JSON.stringify({
    articles: articles.map((a: any) => ({ type: a.type, title: a.title, date: a.date, source: a.source })),
    feed: feed.map((f: any) => ({ type: f.type, title: f.title, date: f.date, source: f.source })),
  }, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

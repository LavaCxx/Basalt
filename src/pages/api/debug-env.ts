import type { APIRoute } from 'astro';
import { setRuntimeEnvAndClearCache, getFeedItems } from '../../lib/api';
import { getAllArticles } from '../../lib/api/notion';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const runtimeEnv = (context as any).runtime?.env || (context.locals as any)?.runtime?.env;
  if (runtimeEnv) setRuntimeEnvAndClearCache(runtimeEnv);

  const result: any = {
    hasRuntimeEnv: !!runtimeEnv,
    hasNotionKey: !!runtimeEnv?.NOTION_API_KEY,
    hasArticlesDb: !!runtimeEnv?.NOTION_ARTICLES_DATABASE_ID,
    hasKV: !!runtimeEnv?.NOTION_CACHE,
  };

  // Try fetching articles directly
  try {
    const articles = await getAllArticles();
    result.articlesCount = articles.length;
    result.articlesSample = articles.slice(0, 2).map((a: any) => ({ id: a.id, title: a.title }));
  } catch (e: any) {
    result.articlesError = e?.message || String(e);
    result.articlesStack = e?.stack?.split('\n').slice(0, 5).join('\n');
  }

  // Try full feed
  try {
    const feed = await getFeedItems();
    result.feedCount = feed.length;
  } catch (e: any) {
    result.feedError = e?.message || String(e);
  }

  return new Response(JSON.stringify(result, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

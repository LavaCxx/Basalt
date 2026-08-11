import type { APIRoute } from 'astro';
import { setRuntimeEnvAndClearCache } from '../../lib/api';
import { getNotionClient, getArticlesDatabaseId } from '../../lib/api/notion/client';
import { kvDelete, isKVAvailable } from '../../lib/kv-cache';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const runtimeEnv = (context as any).runtime?.env || (context.locals as any)?.runtime?.env;
  if (runtimeEnv) setRuntimeEnvAndClearCache(runtimeEnv);

  const result: any = {
    kvAvailable: isKVAvailable(),
  };

  // Clear KV cache for articles
  if (isKVAvailable()) {
    await kvDelete('notion:articles:all');
    await kvDelete('notion:photos:all');
    result.cacheCleared = true;
  }

  // Direct Notion query WITHOUT the 发布 filter (to see all pages)
  try {
    const notion = getNotionClient();
    const dbId = getArticlesDatabaseId();
    result.dbId = dbId;

    // Query without filter first — how many pages total?
    const allResp = await notion.databases.query({
      database_id: dbId,
      page_size: 1,
    });
    result.totalPagesInDb = allResp.results.length;

    // Query WITH the 发布 filter
    const filteredResp = await notion.databases.query({
      database_id: dbId,
      filter: { property: '发布', checkbox: { equals: true } },
      page_size: 1,
    });
    result.publishedPages = filteredResp.results.length;

    // Check what properties the first page has
    if (allResp.results.length > 0) {
      const firstPage = allResp.results[0] as any;
      result.samplePageProps = Object.keys(firstPage.properties || {});
    }
  } catch (e: any) {
    result.notionError = e?.message || String(e);
    result.notionStatus = e?.status;
  }

  return new Response(JSON.stringify(result, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

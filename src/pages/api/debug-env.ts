import type { APIRoute } from 'astro';
import { setRuntimeEnvAndClearCache } from '../../lib/api';
import { getAllArticles, getAllPhotos } from '../../lib/api/notion';
import { fetchDoubanFeed } from '../../lib/api/rss';
import { fetchTelegramFeed } from '../../lib/api/telegram';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const runtimeEnv = (context as any).runtime?.env || (context.locals as any)?.runtime?.env;
  if (runtimeEnv) setRuntimeEnvAndClearCache(runtimeEnv);

  const result: any = {};

  // Test each source individually
  try {
    const articles = await getAllArticles();
    result.articles = articles.length;
  } catch (e: any) {
    result.articlesError = e?.message || String(e);
  }

  try {
    const photos = await getAllPhotos();
    result.photos = photos.length;
  } catch (e: any) {
    result.photosError = e?.message || String(e);
  }

  try {
    const douban = await fetchDoubanFeed();
    result.douban = douban.length;
  } catch (e: any) {
    result.doubanError = e?.message || String(e);
  }

  try {
    const telegram = await fetchTelegramFeed({ limit: 30 });
    result.telegram = telegram.length;
  } catch (e: any) {
    result.telegramError = e?.message || String(e);
  }

  return new Response(JSON.stringify(result, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

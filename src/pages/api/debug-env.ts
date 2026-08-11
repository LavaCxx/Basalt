import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const runtimeEnv = (context as any).runtime?.env || (context.locals as any)?.runtime?.env;
  return new Response(JSON.stringify({
    hasRuntimeEnv: !!runtimeEnv,
    keys: runtimeEnv ? Object.keys(runtimeEnv).filter(k => !k.toLowerCase().includes('key') && !k.toLowerCase().includes('secret')) : [],
    hasNotionKey: !!runtimeEnv?.NOTION_API_KEY,
    hasArticlesDb: !!runtimeEnv?.NOTION_ARTICLES_DATABASE_ID,
    hasPhotosDb: !!runtimeEnv?.NOTION_PHOTOS_DATABASE_ID,
    hasDouban: !!runtimeEnv?.DOUBAN_USER_RSS,
    hasTelegram: !!runtimeEnv?.TELEGRAM_CHANNEL_USERNAME,
    hasKV: !!runtimeEnv?.NOTION_CACHE,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

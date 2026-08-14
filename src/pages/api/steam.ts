import type { APIRoute } from 'astro';
import { getSteamGames } from '../../lib/steam';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const runtimeEnv = (context as any).runtime?.env || (context.locals as any)?.runtime?.env;
  const steamId = runtimeEnv?.STEAM_ID || import.meta.env.PUBLIC_STEAM_ID;
  const apiKey = runtimeEnv?.STEAM_API_KEY;

  try {
    const games = await getSteamGames(steamId, apiKey);
    return new Response(JSON.stringify(games), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=900',
      },
    });
  } catch (error) {
    console.error('Steam API error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch Steam games' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

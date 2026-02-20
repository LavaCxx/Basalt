import type { APIRoute } from 'astro';
import { getFeedItems } from '../../lib/api';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const items = await getFeedItems();
    return new Response(JSON.stringify(items), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch feed' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};

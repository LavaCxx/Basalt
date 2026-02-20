import type { APIRoute } from 'astro';
import { getArchiveItems } from '../../lib/api';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const items = await getArchiveItems();
    return new Response(JSON.stringify(items), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch archives' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};

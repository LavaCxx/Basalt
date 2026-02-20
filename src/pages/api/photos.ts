import type { APIRoute } from 'astro';
import { getAllPhotos } from '../../lib/api/notion';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const photos = await getAllPhotos();
    return new Response(JSON.stringify(photos), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch photos' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};

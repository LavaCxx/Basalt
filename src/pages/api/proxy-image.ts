/**
 * Image proxy endpoint to bypass hotlink protection
 * Usage: /api/proxy-image?url=https://img1.doubanio.com/...
 */

// Disable prerendering for this API route
export const prerender = false;

export async function GET({ url }: { url: URL }) {
  const imageUrl = url.searchParams.get('url');

  if (!imageUrl) {
    return new Response('Missing url parameter', { status: 400 });
  }

  // Only allow doubanio.com images for security
  if (!imageUrl.includes('doubanio.com')) {
    return new Response('Only doubanio.com images are allowed', { status: 403 });
  }

  try {
    // Fetch with douban referer to bypass hotlink protection
    const response = await fetch(imageUrl, {
      headers: {
        'Referer': 'https://www.douban.com/',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return new Response('Failed to fetch image', { status: response.status });
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await response.arrayBuffer();

    return new Response(arrayBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
      },
    });
  } catch (error) {
    console.error('Error proxying image:', error);
    return new Response('Error fetching image', { status: 500 });
  }
}

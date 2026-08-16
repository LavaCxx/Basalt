export const prerender = false;

const imageContentTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

function extractImagesByClass(html: string, className: string): string[] {
  return [
    ...html.matchAll(new RegExp(`<[^>]+class=["'][^"']*${className}[^"']*["'][^>]*>[\\s\\S]*?</`, 'gi')),
  ].flatMap((match) => extractTelescopeImageUrls(match[0]));
}

function extractTelescopeImageUrls(html: string): string[] {
  return [
    ...html.matchAll(/background-image:url\('([^']+)'\)/gi),
    ...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi),
  ]
    .map((match) => match[1])
    .filter((url) => /^https:\/\/cdn\d+\.telesco\.pe\/file\//i.test(url));
}

function extractCurrentImages(html: string, variant?: string | null): string[] {
  if (variant === 'preview') return extractImagesByClass(html, 'tgme_widget_message_link_preview');
  if (variant === 'media') return extractImagesByClass(html, 'tgme_widget_message_(?:photo|video)(?:_wrap)?');

  // Legacy references are positional across every image in the embed.
  return extractTelescopeImageUrls(html);
}

export async function GET({ url }: { url: URL }): Promise<Response> {
  const messageUrl = url.searchParams.get('message');
  const index = Number(url.searchParams.get('index') || '0');
  const variant = url.searchParams.get('variant');

  if (variant && variant !== 'media' && variant !== 'preview') {
    return new Response('Invalid Telegram image variant', {
      status: 400,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  if (!messageUrl || !Number.isInteger(index) || index < 0 || index > 9) {
    return new Response('Invalid Telegram image reference', {
      status: 400,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  let parsed: URL;
  try {
    parsed = new URL(messageUrl);
  } catch {
    return new Response('Invalid message URL', { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  if (parsed.protocol !== 'https:' || parsed.hostname !== 't.me' || !/^\/[^/]+\/\d+$/.test(parsed.pathname)) {
    return new Response('Only Telegram message URLs are allowed', {
      status: 403,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  try {
    const pageResponse = await fetch(`${parsed.href}?embed=1&mode=tme`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    if (!pageResponse.ok) {
      return new Response('Telegram message is unavailable', {
        status: 502,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    const currentImages = extractCurrentImages(await pageResponse.text(), variant);
    const imageUrl = currentImages[index];
    if (!imageUrl) {
      return new Response('Telegram image not found', {
        status: 404,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    const imageResponse = await fetch(imageUrl, {
      headers: { Referer: parsed.href, Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8' },
    });
    const contentType = (imageResponse.headers.get('content-type') || '').toLowerCase().split(';')[0];

    if (!imageResponse.ok || !imageContentTypes.has(contentType)) {
      return new Response('Telegram image is unavailable', {
        status: 502,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    return new Response(imageResponse.body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Telegram image proxy error:', error);
    return new Response('Error loading Telegram image', {
      status: 500,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}

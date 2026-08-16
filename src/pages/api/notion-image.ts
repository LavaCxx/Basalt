import type { APIRoute } from 'astro';
import { setRuntimeEnv } from '../../lib/api/env';
import { getNotionClient } from '../../lib/api/notion/client';

export const prerender = false;

const imageContentTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

export const GET: APIRoute = async (context) => {
  const runtimeEnv = (context as any).runtime?.env || (context.locals as any)?.runtime?.env;
  if (runtimeEnv) setRuntimeEnv(runtimeEnv);

  const pageId = context.url.searchParams.get('page') || '';
  if (!/^[0-9a-f-]{32,36}$/i.test(pageId)) return invalidRequest('Invalid Notion image reference');

  try {
    const knownPhoto = await runtimeEnv?.DB?.prepare(
      `SELECT image, metadata_json FROM items
       WHERE id = ? AND type = 'photo' AND source = 'notion'
       LIMIT 1`
    ).bind(pageId).first();
    if (!knownPhoto) return new Response('Photo not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });

    const storedMetadata = knownPhoto.metadata_json ? JSON.parse(knownPhoto.metadata_json) : {};
    const reference = storedMetadata.notionImage;
    const propertyName = reference?.property || '图片';
    const index = Number.isInteger(reference?.index) ? reference.index : 0;
    if (!reference && !isExpiringNotionFileUrl(knownPhoto.image)) {
      return new Response('Photo image reference not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }

    const notion = getNotionClient();
    const page = (await notion.pages.retrieve({ page_id: pageId })) as any;
    const file = page?.properties?.[propertyName]?.files?.[index];
    const sourceUrl = file?.type === 'file' ? file.file?.url : file?.external?.url;
    if (!sourceUrl) return invalidRequest('Image attachment not found');

    const imageResponse = await fetch(sourceUrl);
    const contentType = (imageResponse.headers.get('content-type') || '').toLowerCase();
    if (!imageResponse.ok || !imageContentTypes.has(contentType)) {
      return new Response('Image not available', { status: 502, headers: { 'Cache-Control': 'no-store' } });
    }

    return new Response(imageResponse.body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (error) {
    console.error('Notion image proxy error:', error);
    return new Response('Image not available', { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
};

function invalidRequest(message: string): Response {
  return new Response(message, { status: 400, headers: { 'Cache-Control': 'no-store' } });
}

function isExpiringNotionFileUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return (
      url.hostname === 'prod-files-secure.s3.us-west-2.amazonaws.com' &&
      url.searchParams.has('X-Amz-Signature')
    );
  } catch {
    return false;
  }
}

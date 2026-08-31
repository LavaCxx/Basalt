const supportedImageContentTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

const imageExtensions: Record<string, string> = {
  avif: 'image/avif',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export function resolveImageContentType(contentType: string | null, fileName?: string): string | null {
  const normalized = (contentType || '').split(';', 1)[0].trim().toLowerCase();
  if (supportedImageContentTypes.has(normalized)) return normalized;

  // Notion occasionally serves uploaded images with the generic `image` MIME type.
  // Only infer a browser-safe type for that known case, based on the attachment name.
  if (normalized !== 'image' || !fileName) return null;
  const extension = fileName.split('.').pop()?.toLowerCase();
  return extension ? imageExtensions[extension] || null : null;
}

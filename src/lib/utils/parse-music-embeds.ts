export type MusicEmbedType = 'song' | 'album' | 'playlist';

export type ArticleMusicBlock =
  | { type: 'html'; html: string }
  | { type: 'music'; musicType: MusicEmbedType; id: string };

const MUSIC_MARKER = /<p(?:\s[^>]*)?>\s*\[music\s+([^\]]+)\]\s*<\/p>/gi;
const ATTRIBUTE = /\b(type|id)\s*=\s*(?:"([^"]*)"|'([^']*)'|&quot;([^&]*)&quot;|([^\s]+))/gi;
const ALLOWED_TYPES = new Set<MusicEmbedType>(['song', 'album', 'playlist']);

function parseAttributes(source: string): { type: MusicEmbedType; id: string } | null {
  const values: Record<string, string> = {};
  for (const match of source.matchAll(ATTRIBUTE)) {
    values[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? match[5] ?? '';
  }

  if (!ALLOWED_TYPES.has(values.type as MusicEmbedType) || !/^\d{1,20}$/.test(values.id || '')) {
    return null;
  }
  return { type: values.type as MusicEmbedType, id: values.id };
}

/** Split trusted article HTML around validated, standalone paragraph music markers. */
export function parseMusicEmbeds(html: string): ArticleMusicBlock[] {
  const blocks: ArticleMusicBlock[] = [];
  let cursor = 0;

  for (const match of html.matchAll(MUSIC_MARKER)) {
    const index = match.index ?? 0;
    const music = parseAttributes(match[1]);
    if (!music) continue;

    const precedingHtml = html.slice(cursor, index);
    if (precedingHtml.trim()) blocks.push({ type: 'html', html: precedingHtml });
    blocks.push({ type: 'music', musicType: music.type, id: music.id });
    cursor = index + match[0].length;
  }

  const remainingHtml = html.slice(cursor);
  if (remainingHtml.trim() || blocks.length === 0) blocks.push({ type: 'html', html: remainingHtml });
  return blocks;
}

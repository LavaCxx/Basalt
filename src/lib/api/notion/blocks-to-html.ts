/**
 * Notion block → HTML conversion (with server-side Shiki highlighting)
 */

import type { GetBlockResponse, RichTextItemResponse } from '@notionhq/client/build/src/api-endpoints';
import { createHighlighter, createJavaScriptRegexEngine } from 'shiki';
import { getNotionClient } from './client';
import { escapeHtml, safeUrl } from './properties';

/** Metadata for a bookmark link, used to render rich link previews */
export interface BookmarkMeta {
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
  domain?: string;
}

/** Options that can be passed to control block rendering behavior */
export interface BlockRenderOptions {
  /**
   * If provided, this function is called for every bookmark block.
   * It should return enriched metadata for the URL (e.g. from link_metadata table),
   * or null/undefined to fall back to domain + favicon.
   */
  resolveBookmarkMeta?: (url: string) => Promise<BookmarkMeta | null | undefined>;
}

const LANG_MAP: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  sh: 'bash',
  shell: 'bash',
  yml: 'yaml',
  md: 'markdown',
};

/** Display labels for code block language tag */
const LANG_LABELS: Record<string, string> = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  bash: 'Bash',
  python: 'Python',
  json: 'JSON',
  html: 'HTML',
  css: 'CSS',
  markdown: 'Markdown',
  jsx: 'JSX',
  tsx: 'TSX',
  yaml: 'YAML',
  plain: 'Text',
};

/** Get display label for a language id */
function getLangLabel(lang: string): string {
  return LANG_LABELS[lang] || (lang.charAt(0).toUpperCase() + lang.slice(1));
}

/** Shiki highlighter singleton — uses pure JS regex engine (no WASM) for Cloudflare compatibility */
let _highlighterPromise: Promise<ReturnType<typeof createHighlighter>> | null = null;

async function getHighlighter() {
  if (!_highlighterPromise) {
    _highlighterPromise = createHighlighter({
      langs: ['javascript', 'typescript', 'bash', 'python', 'json', 'html', 'css', 'markdown', 'jsx', 'tsx', 'yaml'],
      themes: ['github-light'],
      engine: createJavaScriptRegexEngine(),
    });
  }
  return _highlighterPromise;
}


/** Notion color → CSS class name */
const COLOR_MAP: Record<string, string> = {
  red: 'notion-red',
  blue: 'notion-blue',
  green: 'notion-green',
  yellow: 'notion-yellow',
  purple: 'notion-purple',
  pink: 'notion-pink',
  orange: 'notion-orange',
  brown: 'notion-brown',
  gray: 'notion-gray',
};

/**
 * Fetch block children and convert to HTML
 */
export async function fetchBlockChildren(
  blockId: string,
  options?: BlockRenderOptions
): Promise<string> {
  return fetchChildrenRecursive(blockId, options);
}

/**
 * Recursively fetch block children and convert to HTML.
 * Groups consecutive bulleted/numbered items into <ul>/<ol>.
 *
 */
async function fetchChildrenRecursive(
  blockId: string,
  options?: BlockRenderOptions
): Promise<string> {
  const notion = getNotionClient();
  const blocks = await notion.blocks.children.list({
    block_id: blockId,
    page_size: 100,
  });

  const htmlParts: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let listItems: string[] = [];

  const flushList = () => {
    if (listType && listItems.length > 0) {
      htmlParts.push(`<${listType}>${listItems.join('')}</${listType}>`);
      listType = null;
      listItems = [];
    }
  };

  for (const block of blocks.results) {
    const b = block as any;

    // Always group consecutive list items into <ul>/<ol>
    if (b.type === 'bulleted_list_item' || b.type === 'numbered_list_item') {
      const expectedType = b.type === 'bulleted_list_item' ? 'ul' : 'ol';
      if (listType !== expectedType) {
        flushList();
        listType = expectedType;
      }

      // Recursively render nested children inside list items
      let inner = '';
      if (b.has_children) {
        inner = await fetchChildrenRecursive(b.id, options);
      }
      const itemContent = richTextToHtml(b[b.type].rich_text);
      listItems.push(`<li>${itemContent}${inner ? `${inner}` : ''}</li>`);
      continue;
    }

    // Non-list block — close any open list first
    flushList();

    const html = await blockToHtml(block, true, options);
    if (html) htmlParts.push(html);
  }

  flushList();

  return htmlParts.join('\n');
}

/**
 * Convert a Notion block to HTML
 */
/** Apply block-level color as a CSS class wrapper if needed */
function colorWrapper(blockData: any): { cls: string; open: string; close: string } {
  const color = blockData?.color;
  if (!color || color === 'default') return { cls: '', open: '', close: '' };
  const isBackground = color.endsWith('_background');
  const baseColor = isBackground ? color.replace('_background', '') : color;
  const cls = COLOR_MAP[baseColor];
  if (!cls) return { cls: '', open: '', close: '' };
  const fullCls = isBackground ? `${cls}-bg` : cls;
  return { cls: fullCls, open: `<span class="${fullCls}">`, close: '</span>' };
}


/**
 * Convert a video URL to an embeddable iframe URL.
 * Supports YouTube, Bilibili, Vimeo, and other common video platforms.
 * Returns null for URLs that can't be embedded as iframes.
 */
function getVideoEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');

    // YouTube: youtube.com/watch?v=ID or youtu.be/ID
    if (host === 'youtube.com') {
      const vid = u.searchParams.get('v');
      if (vid) return `https://www.youtube.com/embed/${vid}`;
    }
    if (host === 'youtu.be') {
      const vid = u.pathname.slice(1);
      if (vid) return `https://www.youtube.com/embed/${vid}`;
    }

    // Bilibili: bilibili.com/video/BVxxxx
    if (host === 'bilibili.com' || host === 'm.bilibili.com') {
      const match = u.pathname.match(/\/video\/(BV\w+)/);
      if (match) return `https://player.bilibili.com/player.html?bvid=${match[1]}&high_quality=1&autoplay=0`;
    }
    if (host === 'b23.tv') {
      // Short links need following; can't embed directly
      return null;
    }

    // Vimeo
    if (host === 'vimeo.com') {
      const vid = u.pathname.split('/').filter(Boolean)[0];
      if (vid) return `https://player.vimeo.com/video/${vid}`;
    }

    return null;
  } catch {
    return null;
  }
}

function getNeteaseMusicEmbed(url: string): { url: string; kind: 'song' | 'playlist' | 'album' } | null {
  try {
    const parsed = new URL(url.replace(/&amp;/g, '&'));
    const host = parsed.hostname.replace(/^www\./, '');
    if (host !== 'music.163.com') return null;

    const hashParams = parsed.hash.startsWith('#/')
      ? new URLSearchParams(parsed.hash.slice(2).split('?')[1] || '')
      : null;
    const id = parsed.searchParams.get('id') || hashParams?.get('id');
    if (!id || !/^\d+$/.test(id)) return null;

    const path = parsed.hash ? parsed.hash.slice(2).split('?')[0] : parsed.pathname;
    if (path === 'song') {
      return { url: `https://music.163.com/outchain/player?type=2&id=${id}`, kind: 'song' };
    }
    if (path === 'playlist') {
      return { url: `https://music.163.com/outchain/player?type=0&id=${id}`, kind: 'playlist' };
    }
    if (path === 'album') {
      return { url: `https://music.163.com/outchain/player?type=1&id=${id}`, kind: 'album' };
    }

    if (path === 'outchain/player') {
      const type = parsed.searchParams.get('type');
      if (type === '0') return { url: parsed.toString(), kind: 'playlist' };
      if (type === '1') return { url: parsed.toString(), kind: 'album' };
      if (type === '2') return { url: parsed.toString(), kind: 'song' };
    }

    return null;
  } catch {
    return null;
  }
}

export async function blockToHtml(
  block: GetBlockResponse,
  recurse = true,
  options?: BlockRenderOptions
): Promise<string> {
  const b = block as any;

  switch (b.type) {
    case 'paragraph': {
      const pw = colorWrapper(b.paragraph);
      return `<p>${pw.open}${richTextToHtml(b.paragraph.rich_text)}${pw.close}</p>`;
    }
    case 'heading_1':
      return `<h1>${richTextToHtml(b.heading_1.rich_text)}</h1>`;
    case 'heading_2':
      return `<h2>${richTextToHtml(b.heading_2.rich_text)}</h2>`;
    case 'heading_3':
      return `<h3>${richTextToHtml(b.heading_3.rich_text)}</h3>`;
    case 'bulleted_list_item':
      return `<li>${richTextToHtml(b.bulleted_list_item.rich_text)}</li>`;
    case 'numbered_list_item':
      return `<li>${richTextToHtml(b.numbered_list_item.rich_text)}</li>`;
    case 'quote':
      return `<blockquote>${richTextToHtml(b.quote.rich_text)}</blockquote>`;

    case 'code': {
      const lang = b.code.language;
      const mappedLang = LANG_MAP[lang] || lang;
      const code = b.code.rich_text.map((t: RichTextItemResponse) => t.plain_text).join('');
      const label = getLangLabel(mappedLang);
      try {
        const highlighter = await getHighlighter();
        const highlighted = highlighter.codeToHtml(code, { lang: mappedLang, theme: 'github-light' });
        return `<div class="code-block" data-lang="${escapeHtml(label)}">${highlighted}</div>`;
      } catch {
        return `<div class="code-block" data-lang="${escapeHtml(label)}"><pre><code class="language-${escapeHtml(lang)}">${escapeHtml(code)}</code></pre></div>`;
      }
    }

    case 'image': {
      const imageUrl = safeUrl(
        b.image.type === 'external' ? b.image.external.url : b.image.file.url
      );
      const caption = richTextToHtml(b.image.caption || []);
      if (!imageUrl) return '';
      return `<figure><img src="${imageUrl}" alt="${caption}" loading="lazy" />${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`;
    }

    case 'divider':
      return '<hr />';

    case 'video': {
      const videoData = b.video;
      let videoUrl = '';
      let isExternal = false;
      if (videoData.type === 'external') {
        videoUrl = safeUrl(videoData.external.url) || '';
        isExternal = true;
      } else if (videoData.type === 'file') {
        videoUrl = safeUrl(videoData.file.url) || '';
      }
      if (!videoUrl) return '';
      // For external links (YouTube, Bilibili, etc.), try to embed via iframe
      const embedUrl = getVideoEmbedUrl(videoUrl);
      const musicEmbed = embedUrl ? null : getNeteaseMusicEmbed(videoUrl);
      const caption = richTextToHtml(videoData.caption || []);
      if (musicEmbed) {
        return `<div class="music-embed ${musicEmbed.kind}"><iframe src="${musicEmbed.url}" frameborder="0" loading="lazy"></iframe></div>${caption ? `<p class="video-caption">${caption}</p>` : ''}`;
      }
      if (embedUrl) {
        return `<div class="video-embed"><iframe src="${embedUrl}" frameborder="0" allowfullscreen loading="lazy"></iframe></div>${caption ? `<p class="video-caption">${caption}</p>` : ''}`;
      }
      // Direct video file
      return `<div class="video-embed"><video controls preload="metadata"><source src="${videoUrl}" /></video></div>${caption ? `<p class="video-caption">${caption}</p>` : ''}`;
    }

    case 'embed': {
      const embedUrl = safeUrl(b.embed.url);
      if (!embedUrl) return '';
      const caption = richTextToHtml(b.embed.caption || []);
      const musicEmbed = getNeteaseMusicEmbed(embedUrl);
      if (musicEmbed) {
        return `<div class="music-embed ${musicEmbed.kind}"><iframe src="${musicEmbed.url}" frameborder="0" loading="lazy"></iframe></div>${caption ? `<p class="video-caption">${caption}</p>` : ''}`;
      }
      const iframeEmbedUrl = getVideoEmbedUrl(embedUrl) || embedUrl;
      return `<div class="video-embed"><iframe src="${iframeEmbedUrl}" frameborder="0" allowfullscreen loading="lazy"></iframe></div>${caption ? `<p class="video-caption">${caption}</p>` : ''}`;
    }

    case 'callout': {
      const calloutText = richTextToHtml(b.callout.rich_text);
      const icon = b.callout.icon;
      let iconHtml = '';
      if (icon?.type === 'emoji') {
        iconHtml = `<span class="callout-icon">${escapeHtml(icon.emoji)}</span>`;
      } else if (icon?.type === 'external' && icon.external?.url) {
        const iconUrl = safeUrl(icon.external.url);
        if (iconUrl) iconHtml = `<img class="callout-icon" src="${iconUrl}" alt="" />`;
      }
      return `<aside class="callout">${iconHtml}<div class="callout-content">${calloutText}</div></aside>`;
    }

    case 'toggle': {
      const summary = richTextToHtml(b.toggle.rich_text);
      let inner = '';
      if (recurse && b.has_children) {
        inner = await fetchChildrenRecursive(b.id, options);
      }
      return `<details class="notion-toggle"><summary>${summary}</summary>${inner}</details>`;
    }

    case 'to_do': {
      const checked = b.to_do.checked;
      const text = richTextToHtml(b.to_do.rich_text);
      let inner = '';
      if (recurse && b.has_children) {
        inner = await fetchChildrenRecursive(b.id, options);
      }
      return `<div class="notion-todo"><input type="checkbox" disabled${checked ? ' checked' : ''} /><span class="${checked ? 'notion-todo-checked' : ''}">${text}</span>${inner ? `<div class="notion-todo-children">${inner}</div>` : ''}</div>`;
    }

    case 'bookmark': {
      const url = b.bookmark.url;
      const safeHref = safeUrl(url);
      if (!safeHref) return '';
      const captionRaw = b.bookmark.caption || [];
      const captionText = captionRaw.map((t: any) => t.plain_text).join('');
      let domain = '';
      try { domain = new URL(url).hostname; } catch { domain = url; }
      const fallbackFavicon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;

      // Try to resolve enriched metadata (from link_metadata table during sync)
      let meta: BookmarkMeta | null | undefined = null;
      if (options?.resolveBookmarkMeta) {
        try {
          meta = await options.resolveBookmarkMeta(url);
        } catch {
          meta = null;
        }
      }

      const favicon = escapeHtml(meta?.favicon || fallbackFavicon);

      // Determine title and description: enriched meta > caption > domain fallback
      let title = escapeHtml(domain);
      let description = '';

      if (meta?.title) {
        title = escapeHtml(meta.title);
      } else if (captionText) {
        const parts = captionText.split('\n');
        title = escapeHtml(parts[0].trim());
      }

      if (meta?.description) {
        description = escapeHtml(meta.description);
      } else if (captionText) {
        const parts = captionText.split('\n');
        if (parts.length > 1 && parts[1].trim()) {
          description = escapeHtml(parts.slice(1).join(' ').trim());
        }
      }

      // OG image as cover thumbnail
      const coverHtml = meta?.image
        ? `<span class="notion-bookmark-cover"><img src="${escapeHtml(meta.image)}" alt="" loading="lazy" /></span>`
        : '';

      return `<a href="${safeHref}" class="notion-bookmark" target="_blank" rel="noopener noreferrer">${coverHtml}<span class="notion-bookmark-text"><span class="notion-bookmark-icon-row"><img class="notion-bookmark-icon" src="${favicon}" alt="" width="16" height="16" loading="lazy" /></span><span class="notion-bookmark-title">${title}</span>${description ? `<span class="notion-bookmark-desc">${description}</span>` : ''}<span class="notion-bookmark-url">${escapeHtml(meta?.domain || domain)}</span></span></a>`;
    }

    case 'table': {
      if (!recurse || !b.has_children) return '';
      const tableHtml = await fetchChildrenRecursive(b.id, options);
      const hasColHeader = b.table.has_column_header;
      const hasRowHeader = b.table.has_row_header;
      const cls = `notion-table${hasColHeader ? ' has-col-header' : ''}${hasRowHeader ? ' has-row-header' : ''}`;
      return `<table class="${cls}">${tableHtml}</table>`;
    }

    case 'table_row': {
      const cells = b.table_row.cells as RichTextItemResponse[][];
      const tds = cells.map((cell) => `<td>${richTextToHtml(cell)}</td>`).join('');
      return `<tr>${tds}</tr>`;
    }

    case 'column_list': {
      if (!recurse || !b.has_children) return '';
      const html = await fetchChildrenRecursive(b.id, options);
      return `<div class="notion-columns">${html}</div>`;
    }

    case 'column': {
      if (!recurse || !b.has_children) return '';
      const html = await fetchChildrenRecursive(b.id, options);
      return `<div class="notion-column">${html}</div>`;
    }

    default:
      if (b[b.type]?.rich_text) {
        return `<p>${richTextToHtml(b[b.type].rich_text)}</p>`;
      }
      return '';
  }
}

/**
 * Convert Notion rich text to HTML
 */
export function richTextToHtml(richText: RichTextItemResponse[]): string {
  return richText
    .map((text) => {
      let content = escapeHtml(text.plain_text);

      if (text.annotations) {
        if (text.annotations.bold) content = `<strong>${content}</strong>`;
        if (text.annotations.italic) content = `<em>${content}</em>`;
        if (text.annotations.code) content = `<code>${content}</code>`;
        if (text.annotations.strikethrough) content = `<s>${content}</s>`;
        if (text.annotations.underline) content = `<u>${content}</u>`;
      }

      if (text.href) {
        const href = safeUrl(text.href);
        if (href) content = `<a href="${href}" target="_blank" rel="noopener noreferrer">${content}</a>`;
      }

      const color = text.annotations?.color;
      if (color && color !== 'default') {
        const isBackground = color.endsWith('_background');
        const baseColor = isBackground ? color.replace('_background', '') : color;
        const cls = COLOR_MAP[baseColor];
        if (cls) {
          const wrapperClass = isBackground ? `${cls}-bg` : cls;
          content = `<span class="${wrapperClass}">${content}</span>`;
        }
      }

      return content;
    })
    .join('');
}

/**
 * Calculate reading time in minutes
 */
export function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const chineseCharsPerMinute = 400;

  const chineseChars = (content.match(/[\u4e00-\u9fa5]/g) || []).length;
  const words = content
    .replace(/[\u4e00-\u9fa5]/g, '')
    .split(/\s+/)
    .filter((word) => word.length > 0).length;

  const readingTime = Math.ceil(chineseChars / chineseCharsPerMinute + words / wordsPerMinute);
  return Math.max(1, readingTime);
}

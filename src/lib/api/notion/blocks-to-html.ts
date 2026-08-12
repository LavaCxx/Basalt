/**
 * Notion block → HTML conversion (with server-side Shiki highlighting)
 */

import type { GetBlockResponse, RichTextItemResponse } from '@notionhq/client/build/src/api-endpoints';
import { createHighlighter, createJavaScriptRegexEngine } from 'shiki';
import { getNotionClient } from './client';
import { escapeHtml, safeUrl } from './properties';

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
export async function fetchBlockChildren(blockId: string): Promise<string> {
  return fetchChildrenRecursive(blockId);
}

/**
 * Recursively fetch block children and convert to HTML.
 * Groups consecutive bulleted/numbered items into <ul>/<ol>.
 *
 */
async function fetchChildrenRecursive(blockId: string): Promise<string> {
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
        inner = await fetchChildrenRecursive(b.id);
      }
      const itemContent = richTextToHtml(b[b.type].rich_text);
      listItems.push(`<li>${itemContent}${inner ? `${inner}` : ''}</li>`);
      continue;
    }

    // Non-list block — close any open list first
    flushList();

    const html = await blockToHtml(block, true);
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

export async function blockToHtml(block: GetBlockResponse, recurse = true): Promise<string> {
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
        inner = await fetchChildrenRecursive(b.id);
      }
      return `<details class="notion-toggle"><summary>${summary}</summary>${inner}</details>`;
    }

    case 'to_do': {
      const checked = b.to_do.checked;
      const text = richTextToHtml(b.to_do.rich_text);
      let inner = '';
      if (recurse && b.has_children) {
        inner = await fetchChildrenRecursive(b.id);
      }
      return `<div class="notion-todo"><input type="checkbox" disabled${checked ? ' checked' : ''} /><span class="${checked ? 'notion-todo-checked' : ''}">${text}</span>${inner ? `<div class="notion-todo-children">${inner}</div>` : ''}</div>`;
    }

    case 'bookmark': {
      const url = b.bookmark.url;
      const safeHref = safeUrl(url);
      if (!safeHref) return '';
      const caption = richTextToHtml(b.bookmark.caption || []);
      let displayText = caption || escapeHtml(url);
      let domain = '';
      try { domain = new URL(url).hostname; } catch { domain = url; }
      const favicon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
      return `<a href="${safeHref}" class="notion-bookmark" target="_blank" rel="noopener noreferrer"><span class="notion-bookmark-text"><span class="notion-bookmark-title">${displayText}</span><span class="notion-bookmark-meta"><img class="notion-bookmark-icon" src="${escapeHtml(favicon)}" alt="" width="16" height="16" loading="lazy" /><span class="notion-bookmark-url">${escapeHtml(domain)}</span></span></span></a>`;
    }

    case 'table': {
      if (!recurse || !b.has_children) return '';
      const tableHtml = await fetchChildrenRecursive(b.id);
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

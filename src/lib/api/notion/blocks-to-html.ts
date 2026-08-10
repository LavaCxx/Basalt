/**
 * Notion block → HTML conversion (with server-side Shiki highlighting)
 */

import type { GetBlockResponse, RichTextItemResponse } from '@notionhq/client/build/src/api-endpoints';
import { codeToHtml } from 'shiki';
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

/**
 * Fetch block children and convert to HTML
 */
export async function fetchBlockChildren(blockId: string): Promise<string> {
  const notion = getNotionClient();
  const blocks = await notion.blocks.children.list({
    block_id: blockId,
    page_size: 100,
  });

  const htmlParts: string[] = [];
  for (const block of blocks.results) {
    const html = await blockToHtml(block);
    if (html) htmlParts.push(html);
  }

  return htmlParts.join('\n');
}

/**
 * Convert a Notion block to HTML
 */
export async function blockToHtml(block: GetBlockResponse): Promise<string> {
  const b = block as any;

  switch (b.type) {
    case 'paragraph':
      return `<p>${richTextToHtml(b.paragraph.rich_text)}</p>`;
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
      const code = b.code.rich_text.map((t: RichTextItemResponse) => t.plain_text).join('');
      try {
        return await codeToHtml(code, { lang: LANG_MAP[lang] || lang, theme: 'github-light' });
      } catch {
        return `<pre><code class="language-${lang}">${escapeHtml(code)}</code></pre>`;
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
      return `<aside class="callout">${calloutText}</aside>`;
    }

    case 'toggle':
      return `<details><summary>${richTextToHtml(b.toggle.rich_text)}</summary></details>`;

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
        if (href) content = `<a href="${href}">${content}</a>`;
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

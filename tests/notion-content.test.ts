import { describe, expect, it } from 'vitest';
import { getNotionContentType, normalizeContentPath } from '../src/lib/api/notion/articles';
import { richTextToHtml } from '../src/lib/api/notion/blocks-to-html';
import type { NotionArticleProperties } from '../src/lib/api/notion/properties';

describe('Notion content classification', () => {
  it('defaults missing type to article', () => {
    expect(getNotionContentType({})).toBe('article');
    expect(getNotionContentType({ 类型: { select: { name: '文章' } } })).toBe('article');
  });

  it('maps 页面 to a standalone page and normalizes paths', () => {
    const props = { 类型: { select: { name: '页面' } } } satisfies NotionArticleProperties;
    expect(getNotionContentType(props)).toBe('page');
    expect(normalizeContentPath('about', 'page')).toBe('/about');
    expect(normalizeContentPath('/about/', 'page')).toBe('/about');
    expect(normalizeContentPath('新博客Again', 'article')).toBe('/articles/新博客Again');
  });
});

describe('Notion rich text line breaks', () => {
  it('preserves soft line breaks while escaping HTML', () => {
    const richText = [{
      type: 'text',
      plain_text: '第一行\n<script>alert(1)</script>',
      href: null,
      annotations: {
        bold: false,
        italic: false,
        strikethrough: false,
        underline: false,
        code: false,
        color: 'default',
      },
      text: { content: '第一行\n<script>alert(1)</script>', link: null },
    }] as any;

    expect(richTextToHtml(richText)).toBe('第一行<br />&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});

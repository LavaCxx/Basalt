/**
 * Notion property types and extraction helpers
 */

import type { RichTextItemResponse } from '@notionhq/client/build/src/api-endpoints';

/**
 * Article properties in Notion database
 */
export interface NotionArticleProperties {
  标题?: { title: RichTextItemResponse[] };
  标题_EN?: { title: RichTextItemResponse[] };
  Title?: { title: RichTextItemResponse[] };
  摘要?: { rich_text: RichTextItemResponse[] };
  Excerpt?: { rich_text: RichTextItemResponse[] };
  标签?: { multi_select: { name: string }[] };
  Tags?: { multi_select: { name: string }[] };
  精选?: { checkbox: boolean };
  Featured?: { checkbox: boolean };
  发布?: { checkbox: boolean };
  Published?: { checkbox: boolean };
  封面?: { files: { type: string; file?: { url: string }; external?: { url: string } }[] };
  Cover?: { files: { type: string; file?: { url: string }; external?: { url: string } }[] };
  Slug?: { rich_text: RichTextItemResponse[] };
  slug?: { rich_text: RichTextItemResponse[] };
}

/**
 * Photo properties in Notion database
 */
export interface NotionPhotoProperties {
  标题?: { title: RichTextItemResponse[] };
  Title?: { title: RichTextItemResponse[] };
  日期?: { date: { start: string } | null };
  Date?: { date: { start: string } | null };
  相册?: { select: { name: string } | null };
  Album?: { select: { name: string } | null };
  地点?: { rich_text: RichTextItemResponse[] };
  Location?: { rich_text: RichTextItemResponse[] };
  图片?: { files: { type: string; file?: { url: string }; external?: { url: string } }[] };
  Image?: { files: { type: string; file?: { url: string }; external?: { url: string } }[] };
}

/**
 * Extract plain text from Notion rich text
 */
export function getPlainText(richText: RichTextItemResponse[] | undefined): string {
  if (!richText) return '';
  return richText.map((text) => text.plain_text).join('');
}

/**
 * Get cover image URL from Notion page
 */
export function getCoverImage(
  files: { type: string; file?: { url: string }; external?: { url: string } }[] | undefined
): string | undefined {
  if (!files || files.length === 0) return undefined;
  const file = files[0];
  if (file.type === 'file' && file.file) {
    return file.file.url;
  }
  if (file.type === 'external' && file.external) {
    return file.external.url;
  }
  return undefined;
}

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Validate and escape URL for safe use in HTML attributes
 */
export function safeUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) {
    return escapeHtml(url);
  }
  return '';
}

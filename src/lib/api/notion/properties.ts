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
  AI参与度?: { select: { name: string } | null };
  发布?: { checkbox: boolean };
  Published?: { checkbox: boolean };
  封面?: { files: { type: string; file?: { url: string }; external?: { url: string } }[] };
  Cover?: { files: { type: string; file?: { url: string }; external?: { url: string } }[] };
  路径?: { rich_text: RichTextItemResponse[] };
  Slug?: { rich_text: RichTextItemResponse[] };
  slug?: { rich_text: RichTextItemResponse[] };
  类型?: { select: { name: string } | null };
}

export interface NotionFriendProperties {
  名称?: { title: RichTextItemResponse[] };
  描述?: { rich_text: RichTextItemResponse[] };
  博客地址?: { url: string | null };
  头像地址?: { url: string | null };
  RSS地址?: { url: string | null };
}

/**
 * Photo properties in Notion database
 */
export interface NotionPhotoProperties {
  标题?: { title: RichTextItemResponse[] };
  Title?: { title: RichTextItemResponse[] };
  日期?: { date: { start: string } | null };
  Date?: { date: { start: string } | null };
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

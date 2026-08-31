import { createSignal, onCleanup, onMount, Show, For, type JSX } from 'solid-js';
import { isServer } from 'solid-js/web';
import type { MicroblogFeedItem } from '../../../lib/types';
import Lightbox from '../Lightbox';
import SourceBadge from '../SourceBadge';
import SmartImage from '../SmartImage';
import { formatTime } from './formatDate';

interface PhotoItem {
  id: string;
  src: string;
  thumbnail: string;
  alt: string;
  width?: number;
  height?: number;
}

const urlPattern = /https?:\/\/[^\s<>"')\]]+/gi;

function linkifyTelegramText(text: string): JSX.Element {
  const nodes: JSX.Element[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = urlPattern.exec(text))) {
    if (match.index > cursor) {
      nodes.push(text.slice(cursor, match.index));
    }

    let href = match[0];
    const trailingPunctuation = href.match(/[.,;:!?]+$/);
    if (trailingPunctuation) href = href.slice(0, -trailingPunctuation[0].length);

    let label = href;
    try {
      label = decodeURI(href);
    } catch {
      // Keep the raw URL when it contains an invalid escape sequence.
    }

    nodes.push(
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        class="telegram-inline-link"
      >
        {label}
      </a>
    );

    cursor = match.index + href.length;
    urlPattern.lastIndex = cursor;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

function getPhotoItems(item: MicroblogFeedItem): PhotoItem[] {
  const attachments = item.metadata?.attachments || [];
  const photoItems: PhotoItem[] = [];

  if (item.image) {
    const mainAttachment = attachments.find((attachment) => attachment.type === 'image' && attachment.url === item.image);
    photoItems.push({
      id: `${item.id}-main`,
      src: item.image,
      thumbnail: item.image,
      alt: item.title || '',
      width: mainAttachment?.width,
      height: mainAttachment?.height,
    });
  }

  for (const att of attachments) {
    if (att.type === 'image' && att.url && !photoItems.some((p) => p.src === att.url)) {
      photoItems.push({
        id: `${item.id}-${att.url.slice(-10)}`,
        src: att.url,
        thumbnail: att.thumbnail || att.url,
        alt: att.alt || '',
        width: att.width,
        height: att.height,
      });
    }
  }

  return photoItems;
}

export default function MicroblogCard(props: { item: MicroblogFeedItem }) {
  const item = () => props.item;
  const [expanded, setExpanded] = createSignal(false);
  const [lightboxOpen, setLightboxOpen] = createSignal(false);
  const [lightboxIndex, setLightboxIndex] = createSignal(0);
  const [contentElement, setContentElement] = createSignal<HTMLDivElement>();
  const photos = () => getPhotoItems(item());
  const content = () =>
    item().source === 'telegram' ? linkifyTelegramText(item().content) : item().content;
  const linkPreview = () => item().metadata?.linkPreview;
  const previewHost = () => {
    try {
      return linkPreview()?.url ? new URL(linkPreview()!.url).hostname : undefined;
    } catch {
      return undefined;
    }
  };
  const [naturalHeight, setNaturalHeight] = createSignal(0);
  const collapsedHeight = () => 300;
  const isOversized = () => naturalHeight() > collapsedHeight();

  onMount(() => {
    const element = contentElement();
    if (!element) return;
    setNaturalHeight(element.scrollHeight);
  });

  onCleanup(() => {
    if (!isServer) document.body.style.overflow = '';
  });

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
    if (!isServer) document.body.style.overflow = 'hidden';
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
    if (!isServer) document.body.style.overflow = '';
  };

  const goToPrevious = () => {
    setLightboxIndex((index) => (index > 0 ? index - 1 : photos().length - 1));
  };

  const goToNext = () => {
    setLightboxIndex((index) => (index < photos().length - 1 ? index + 1 : 0));
  };

  return (
    <div class="py-4">
      <div class="flex items-center gap-1.5 mb-2 text-xs text-text-muted">
        <SourceBadge
          source={item().source}
          channel={item().metadata?.channel}
          sourceUrl={item().url}
        />
        <time class="feed-card-time">{formatTime(item().date)}</time>
      </div>
      <div
        ref={setContentElement}
        classList={{ 'microblog-collapsible': isOversized() && !expanded() }}
        style={isOversized() && !expanded() ? { 'max-height': `${collapsedHeight()}px` } : undefined}
      >
        <p class="text-text-primary leading-relaxed whitespace-pre-line">{content()}</p>
        <Show when={linkPreview()}>
          <a
            href={linkPreview()!.url}
            target="_blank"
            rel="noopener noreferrer"
            class="telegram-link-preview mt-3 group/preview"
          >
            <div class="telegram-link-preview-content">
              <Show when={linkPreview()!.siteName}>
                <span class="telegram-link-preview-site">{linkPreview()!.siteName}</span>
              </Show>
              <Show when={linkPreview()!.title}>
                <span class="telegram-link-preview-title">{linkPreview()!.title}</span>
              </Show>
              <Show when={linkPreview()!.description}>
                <span class="telegram-link-preview-description">{linkPreview()!.description}</span>
              </Show>
              <Show when={previewHost()}>
                <span class="telegram-link-preview-url">{previewHost()}</span>
              </Show>
            </div>
            <Show when={linkPreview()!.image}>
              <span class="telegram-link-preview-cover">
                <SmartImage
                  src={linkPreview()!.image}
                  alt={linkPreview()!.title || linkPreview()!.url}
                  class="w-full h-full"
                />
              </span>
            </Show>
          </a>
        </Show>
        <Show when={photos().length >= 1}>
          <div class="mt-3 flex gap-1">
            <For each={photos().slice(0, 3)}>
              {(photo, index) => (
                <button
                  type="button"
                  class="block cursor-zoom-in border-0 bg-transparent p-0"
                  aria-label={`查看图片 ${index() + 1}，共 ${photos().length} 张`}
                  onClick={() => openLightbox(index())}
                >
                  <SmartImage
                    src={photo.thumbnail}
                    alt={photo.alt}
                    class="rounded"
                    naturalSizing={photos().length === 1}
                    width={photo.width}
                    height={photo.height}
                    classList={{ 'max-w-xs': photos().length === 1, 'w-24 h-24': photos().length > 1 }}
                  />
                </button>
              )}
            </For>
          </div>
        </Show>
      </div>
      <Show when={isOversized()}>
        <button
          type="button"
          class="mt-2 text-xs text-text-muted hover:text-text-primary transition-colors"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded() ? '收起' : '展开全文'}
        </button>
      </Show>
      <div class="mt-2 flex items-center gap-4 text-xs text-text-muted">
        <Show when={item().metadata?.likes !== undefined}>
          <span>{item().metadata!.likes} 赞</span>
        </Show>
        <Show when={item().metadata?.replies !== undefined}>
          <span>{item().metadata!.replies} 评论</span>
        </Show>
      </div>
      <Lightbox
        open={lightboxOpen()}
        photos={photos()}
        index={lightboxIndex()}
        onClose={closeLightbox}
        onPrevious={goToPrevious}
        onNext={goToNext}
      />
    </div>
  );
}

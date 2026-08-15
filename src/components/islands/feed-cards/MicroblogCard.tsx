import { Show, For } from 'solid-js';
import type { MicroblogFeedItem } from '../../../lib/types';
import SourceBadge from '../SourceBadge';
import SmartImage from '../SmartImage';
import { formatDate } from './formatDate';

interface PhotoItem {
  id: string;
  src: string;
  thumbnail: string;
  alt: string;
}

function getPhotoItems(item: MicroblogFeedItem): PhotoItem[] {
  const attachments = item.metadata?.attachments || [];
  const photoItems: PhotoItem[] = [];

  if (item.image) {
    photoItems.push({ id: `${item.id}-main`, src: item.image, thumbnail: item.image, alt: item.title || '' });
  }

  for (const att of attachments) {
    if (att.type === 'image' && att.url && !photoItems.some((p) => p.src === att.url)) {
      photoItems.push({ id: `${item.id}-${att.url.slice(-10)}`, src: att.url, thumbnail: att.thumbnail || att.url, alt: att.alt || '' });
    }
  }

  return photoItems;
}

export default function MicroblogCard(props: { item: MicroblogFeedItem }) {
  const item = () => props.item;
  const photos = () => getPhotoItems(item());

  return (
    <div class="py-4 border-b border-border-subtle">
      <div class="flex items-center gap-1.5 mb-2 text-xs text-text-muted">
        <SourceBadge source={item().source} channel={item().metadata?.channel} />
        <time class="ml-auto">{formatDate(item().date)}</time>
      </div>
      <p class="text-text-primary leading-relaxed">{item().content}</p>
      <Show when={photos().length >= 1}>
        <div class="mt-3 flex gap-1">
          <For each={photos().slice(0, 3)}>
            {(photo) => (
              <SmartImage
                src={photo.thumbnail}
                alt={photo.alt}
                class="rounded"
                classList={{ 'max-w-xs': photos().length === 1, 'w-24 h-24': photos().length > 1 }}
              />
            )}
          </For>
        </div>
      </Show>
      <div class="mt-2 flex items-center gap-4 text-xs text-text-muted">
        <Show when={item().metadata?.likes !== undefined}>
          <span>{item().metadata!.likes} 赞</span>
        </Show>
        <Show when={item().metadata?.replies !== undefined}>
          <span>{item().metadata!.replies} 评论</span>
        </Show>
      </div>
    </div>
  );
}

import { Show } from 'solid-js';
import type { PhotoFeedItem } from '../../../lib/types';
import SourceBadge from '../SourceBadge';
import SmartImage from '../SmartImage';
import { formatDate } from './formatDate';

export default function PhotoCard(props: { item: PhotoFeedItem }) {
  const item = () => props.item;

  return (
    <div class="py-4 border-b border-border-subtle">
      <div class="flex items-center gap-1.5 mb-2 text-xs text-text-muted">
        <SourceBadge source={item().source} />
        <time class="ml-auto">{formatDate(item().date)}</time>
      </div>
      <div class="flex gap-4">
        <a href={item().url || '#'} class="block flex-shrink-0">
          <SmartImage src={item().image} alt={item().title || ''} class="rounded-lg w-32 h-32" />
        </a>
        <div class="flex-1 min-w-0 py-1">
          <Show when={item().title}>
            <h3 class="font-ui text-lg text-text-primary">{item().title}</h3>
          </Show>
          <Show when={item().metadata?.location}>
            <p class="mt-1 text-xs text-text-muted">{item().metadata!.location}</p>
          </Show>
        </div>
      </div>
    </div>
  );
}

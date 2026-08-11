import { Show } from 'solid-js';
import type { MediaFeedItem } from '../../../lib/types';
import type { MediaType } from '../../../lib/media-config';
import { mediaTypeLabels, getStatusLabel } from '../../../lib/media-config';
import SourceBadge from '../SourceBadge';
import { formatDate } from './formatDate';

export default function MediaCard(props: { item: MediaFeedItem }) {
  const item = () => props.item;
  const meta = () => item().metadata;
  const ratingPercent = () => {
    const m = meta();
    if (!m?.rating) return 0;
    return Math.round((m.rating / (m.maxRating || 5)) * 5);
  };
  const ratingLabel = () => {
    const r = ratingPercent();
    if (r >= 5) return '力荐';
    if (r >= 4) return '推荐';
    if (r >= 3) return '还行';
    if (r >= 2) return '较差';
    return '很差';
  };

  return (
    <div class="py-4 border-b border-border-subtle">
      <div class="flex items-center gap-1.5 mb-2 text-xs text-text-muted">
        <SourceBadge
          source={item().source}
          mediaTypeLabel={meta() ? mediaTypeLabels[meta()!.mediaType as MediaType] : undefined}
        />
        <time class="ml-auto">{formatDate(item().date)}</time>
      </div>
      <div class="flex gap-4 items-start">
        <Show when={item().image}>
          <a href={item().url || '#'} class="block flex-shrink-0" target="_blank" rel="noopener">
            <img
              src={item().image!}
              alt={item().title || ''}
              class="w-16 h-24 object-cover rounded flex-shrink-0 hover:opacity-80 transition-opacity"
              loading="lazy"
            />
          </a>
        </Show>
        <div class="flex-1 min-w-0 -mt-1">
          <Show when={meta()?.status}>
            <span class="media-badge" data-media={meta()?.mediaType} data-status={meta()?.status}>
              {getStatusLabel(meta()!.status!, meta()!.mediaType)}
            </span>
          </Show>
          <a href={item().url || '#'} class="group/title" target="_blank" rel="noopener">
            <h3 class="font-ui text-base text-text-primary group-hover/title:underline transition-colors mt-1.5">{item().title}</h3>
          </a>
          <Show when={meta()?.creator}>
            <p class="text-xs text-text-muted mt-0.5">{meta()!.creator}</p>
          </Show>
          <Show when={meta()?.rating}>
            <div class="mt-1 flex items-center gap-2">
              <span class="text-xs tracking-tight">
                <span class="text-text-primary">{'★'.repeat(ratingPercent())}</span>
                <span class="text-text-muted">{'☆'.repeat(5 - ratingPercent())}</span>
              </span>
              <span class="text-xs text-text-muted">{ratingLabel()}</span>
            </div>
          </Show>
          <Show when={meta()?.review}>
            <p class="text-sm text-text-secondary mt-1">{meta()!.review}</p>
          </Show>
        </div>
      </div>
    </div>
  );
}

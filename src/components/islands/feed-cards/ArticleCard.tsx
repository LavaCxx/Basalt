import { Show } from 'solid-js';
import type { ArticleFeedItem } from '../../../lib/types';
import SourceBadge from '../SourceBadge';
import { formatDate } from './formatDate';

export default function ArticleCard(props: { item: ArticleFeedItem }) {
  const item = () => props.item;
  const meta = () => item().metadata;

  return (
    <div class="py-4 border-b border-border-subtle">
      <div class="flex items-center gap-1.5 mb-2 text-xs text-text-muted">
        <SourceBadge source={item().source} feedName={meta()?.feedName} />
        <time class="ml-auto">{formatDate(item().date)}</time>
      </div>
      <div class="flex gap-4">
        <Show when={item().image}>
          <a href={item().url || '#'} class="block flex-shrink-0">
            <img src={item().image!} alt={item().title || ''} class="w-32 h-24 rounded-lg object-cover" loading="lazy" />
          </a>
        </Show>
        <div class="flex-1 min-w-0">
          <a href={item().url || '#'} class="group/link">
            <h3 class="font-ui text-lg text-text-primary group-hover/link:underline transition-colors">{item().title}</h3>
          </a>
          <Show when={meta()?.excerpt}>
            <p class="mt-1 text-sm text-text-secondary line-clamp-2">{meta()!.excerpt}</p>
          </Show>
          <Show when={meta()?.readingTime}>
            <p class="mt-2 text-xs text-text-muted">阅读需要约 {meta()!.readingTime} 分钟</p>
          </Show>
        </div>
      </div>
    </div>
  );
}

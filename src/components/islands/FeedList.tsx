/**
 * Feed List — renders mixed feed items using type-specific card components
 * Data is passed from server-side render (index.astro)
 */

import { createSignal, Show, For, Switch, Match } from 'solid-js';
import type { FeedItem } from '../../lib/types';
import MicroblogCard from './feed-cards/MicroblogCard';
import PhotoCard from './feed-cards/PhotoCard';
import MediaCard from './feed-cards/MediaCard';
import ArticleCard from './feed-cards/ArticleCard';

interface FeedListProps {
  items?: FeedItem[];
}

export default function FeedList(props: FeedListProps) {
  const [items] = createSignal<FeedItem[]>(
    (props.items || []).map((item) => ({
      ...item,
      date: new Date(item.date),
    }))
  );
  const [loading] = createSignal(false);

  return (
    <div class="space-y-0">
      <Show when={loading()}>
        <div class="py-12 text-center text-text-muted">加载中...</div>
      </Show>

      <For each={items()}>
        {(item) => (
          <article class="group">
            <Switch fallback={<div></div>}>
              <Match when={item.type === 'microblog'}>
                <MicroblogCard item={item as any} />
              </Match>
              <Match when={item.type === 'photo' && item.image}>
                <PhotoCard item={item as any} />
              </Match>
              <Match when={item.type === 'media'}>
                <MediaCard item={item as any} />
              </Match>
              <Match when={item.type === 'article'}>
                <ArticleCard item={item as any} />
              </Match>
            </Switch>
          </article>
        )}
      </For>
    </div>
  );
}
